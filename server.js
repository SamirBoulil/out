'use strict';

const express = require('express');
const Slapp = require('slapp');
const Utils = require('./Utils');
const ConvoStore = require('slapp-convo-beepboop');
const Context = require('slapp-context-beepboop');
const ApiHelper = require('./ApiHelper');

// TODO:
// - Wording
// - Images (Start/congraz) generique ou spécifique
//
// - Game mechanics (automatic clue or not ?, number of tries) - done
// - Protection - done
// - user master skill - done
// - Write rules in the help - done

// use `PORT` env var on Beep Boop - default to 3000 locally
var port = process.env.PORT || 3000

var slapp = Slapp({
  // Beep Boop sets the SLACK_VERIFY_TOKEN env var
  verify_token: process.env.SLACK_VERIFY_TOKEN,
  convo_store: ConvoStore(),
  context: Context()
})

// enable debugging
require('beepboop-slapp-presence-polyfill')(slapp, {
  debug: true
})

// Start
slapp.message('^start', ['direct_message'], (msg) => {
  ApiHelper.isPlayerRegistered(msg.meta.user_id)
    .then((isRegistered) => {
      if (!isRegistered) {
        msg.say({
          text: '',
          attachments: [{
            fallback: 'Do you want to start the Once Uppon a time quizz ?',
            title: 'Do you want to start the Once Uppon a time quizz ?',
            callback_id: 'register_callback',
            color: '#3AA3E3',
            attachment_type: 'default',
            actions: [{
              name: 'register_answer',
              text: 'Hell yeah!',
              style: 'primary',
              type: 'button',
              value: 'yes'
            },
              {
                name: 'register_answer',
                text: 'Nope, not intrested',
                type: 'button',
                value: 'no'
              }]
          }]
        })
      } else {
        console.log('About to get a random question.');
        ApiHelper.getRandomQuestion(msg.meta.user_id)
          .then((question) => {
            if (question !== null) {
              ApiHelper.setCurrentQuestion(msg.meta.user_id, question.question_id)
                .then(() => {
                  msg.say('Ok, here is a new question for you.')
                  msg.say(question.question);
                });
            } else {
              msg.say('Impressive! you answered correctly to all the questions!');
            }
          });
      }
    })
    .catch(function(error) {
      // TODO: Send message if an error occured
    });
})

slapp.action('register_callback', 'register_answer', (msg, value) => {
  var registerAnswer = 'Alright, then come back to me when you are ready!';

  if (value === 'yes') {
    registerAnswer = 'Awesome here is a question for you:';
    ApiHelper.createUser(msg.meta.user_id)
      .then(() => {
        console.log('USER CREATED');
        ApiHelper.getRandomQuestion(msg.meta.user_id)
          .then((question) => {
            console.log('RANDOM QUESTION SELECTED' + question.question_id);
            ApiHelper.setCurrentQuestion(msg.meta.user_id, question.question_id)
              .then(() => {
                var responseAnswer = {
                  text: '',
                  attachments: [{
                    fallback: 'Do you want to register ?',
                    title: "Do you want to start the Once Uppon a time quizz ?",
                    text: question.question,
                    callback_id: 'register_callback',
                    color: '#3AA3E3',
                  }]
                };
                msg.respond(msg.body.response_url, responseAnswer);
              });
          });
      });
  } else {
    var responseAnswer = {
      text: '',
      attachments: [{
        fallback: 'Do you want to register ?',
        title: "Do you want to start the Once Uppon a time quizz ?",
        text: registerAnswer,
        callback_id: 'register_callback',
        color: '#3AA3E3',
      }]
    };

    msg.respond(msg.body.response_url, responseAnswer);
  }
});

// Answer
slapp.message('^<@([^>]+)>', ['direct_message'], (msg, userId) => {
  ApiHelper.isPlayerRegistered(msg.meta.user_id)
    .then((isRegistered) => {
      if (isRegistered) {
        console.log('Answer: ' + userId);
        ApiHelper.getUser(msg.meta.user_id)
          .then((user) => {
            ApiHelper.getCurrentQuestion(msg.meta.user_id)
              .then((question) => {
                if (question !== null) {
                  console.log('USER : '+ userId);
                  console.log('answer: '+ question.answer_uid);
                  if (userId === question.answer_uid) {
                    msg.say('*Good answer!* If you want to know the whole story, do not hesitate to have a drink with '+ question.answer_uid+ '! ('+ question.master_skill+')');
                    msg.say('_Type "leaderboard", to see the leaderboard._');

                    ApiHelper.setCurrentQuestion(msg.meta.user_id, null);

                    var totalPoints = user.points + (3 - user.used_clues);
                    ApiHelper.setTotalPoints(msg.meta.user_id, totalPoints);

                    var answeredQuestions = [];
                    if (typeof(user.answeredQuestions) !== 'undefined') {
                      answeredQuestions = user.answeredQuestions;
                    }
                    answeredQuestions.push(question.question_id);
                    console.log(user);
                    console.log(answeredQuestions)
                    ApiHelper.setAnsweredQuestions(msg.meta.user_id, answeredQuestions);

                  } else {
                    msg.say('Nope, it is not '+ userId + '!')
                    if (user.used_clues < question.clues.length) {
                      console.log(question);
                      console.log(question.clues[user.used_clues]);
                      var clueIndex = user.used_clues+1;
                      msg.say('Clue ' + clueIndex);
                      msg.say(question.clues[user.used_clues]);
                      ApiHelper.setCluesNumber(msg.meta.user_id, clueIndex);
                    } else {
                      ApiHelper.setCurrentQuestion(msg.meta.user_id, null);
                      ApiHelper.setCluesNumber(msg.meta.user_id, clueIndex);
                      msg.say('You have no clue left for this question. Type "start" to try guess a new question.');
                    }
                  }
                } else {
                  msg.say('Type "start" to start playing or "help" to display the rules.');
                }
              });
          });
      } else {
        msg.say('Type "start" to start playing or "help" to display the rules.');
      }
    });

});

// clue
slapp.message('^clue', ['direct_message'], (msg) => {
  ApiHelper.isPlayerRegistered(msg.meta.user_id)
    .then((isRegistered) => {
      if (isRegistered) {
        // TODO: Protect for unregistered users
        console.log('User asks for a clue.');
        ApiHelper.getUser(msg.meta.user_id)
          .then((user) => {
            if (typeof(user.current_question) === 'undefined') {
              msg.say('_Type "start", to guess a new question._');
            } else if (user.used_clues <= 0) {
              msg.say('You need to guess someone to get a clue.')
            } else if (user.used_clues < 4) {
              ApiHelper.getCurrentQuestion(msg.meta.user_id)
                .then((question) => {
                  if (question !== null) {
                    console.log(question);
                    console.log(question.clues[user.used_clues - 1]);
                    var clueIndex = user.used_clues;
                    msg.say('Clue ' + clueIndex);
                    msg.say(question.clues[user.used_clues - 1]);
                  } else {
                    msg.say('_Type "start", to guess a new question._');
                  }
                });
            } else {
              msg.say('Sorry, no clues left for you. Ask around if you can find the answer.');
            }
          });
      } else {
        msg.say('Type "start" to start playing or "help" to display the rules.');
      }
    })
});

// Leaderboard
slapp.message('^leaderboard', ['direct_message'], (msg) => {
  ApiHelper.getUsers().then((users) => {
    console.log(users);
    var leaderBoard = users.sort((element1, element2) => {
      return element1.points < element2.points;
    });

    var leaderBoard = users.map((element, index) => {
      var rank = index + 1;
      return rank + " - <@" + element.userId + "> _("+ element.points +" points)_";
    });

    msg.say('*Leaderboard:*\n' + leaderBoard.join('\n'));
  });
});

// Question
slapp.message('^question', ['direct_message'], (msg) => {
  ApiHelper.isPlayerRegistered(msg.meta.user_id)
    .then((isRegistered) => {
      if (isRegistered) {
        ApiHelper.getCurrentQuestion(msg.meta.user_id)
          .then((question) => {
            if (question !== null) {
              msg.say('Here is the question you need to answer:');
              msg.say(question.question);
            } else {
              msg.say('_Type "start", to guess a new question._');
            }
          });
      } else {
        msg.say('Type "start" to start playing or "help" to display the rules.');
      }
    });
  //
});
//


//*********************************************
// Help handler
//*********************************************
slapp.message('help', ['direct_message'], (msg) => {
  var HELP_TEXT = `
  Welcome to the Once Upon a time Akeneo quizz !
  Some of your colleagues have some awesome stories. Guess who!
  \`help\` - If you need any help.
  \`start\` - I will give you a new teaser.
  \`clue\` - Display the last clue I gave you.
  \`question\` - Display the current story.
  \`leaderboard\` - Who is our Sherlock Holmes?

  *Send out all your cool stories at:* https://goo.gl/forms/EaYrb6bWkKjHXJ2v2
  `;
  msg.say(HELP_TEXT)
})


// attach Slapp to express server
var server = slapp.attachToExpress(express())

// start http server
server.listen(port, (err) => {
  if (err) {
    return console.error(err)
  }

  console.log(`Listening on port ${port}`)
})

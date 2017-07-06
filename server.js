'use strict';

const express = require('express');
const Slapp = require('slapp');
const Utils = require('./Utils');
const ConvoStore = require('slapp-convo-beepboop');
const Context = require('slapp-context-beepboop');
const ApiHelper = require('./ApiHelper');


// TODO:
// - Dataset/fixtures
// - Wording
// - Images
// - Game mechanics (automatic clue or not ?, number of tries)

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

// Answer
slapp.message('^<@([^>]+)>', ['direct_message'], (msg, userId) => {
  console.log('Answer: ' + userId);
  ApiHelper.getUser(msg.meta.user_id)
  .then((user) => {
    ApiHelper.getCurrentQuestion(msg.meta.user_id)
      .then((question) => {
        if (question !== null) {
          if (userId === question.answer_uid) {
            console.log('Good answer');
            msg.say('GOOD JOB, here is the explanation:');
            msg.say(question.description);
            msg.say('_Type "leaderboard", to see the leaderboard._');

            ApiHelper.setCurrentQuestion(msg.meta.user_id, null);

            var totalPoints = user.points + (5 - user.used_clues);
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
            msg.say('Nope. _(you can type "clue" to show a hint.)_')
          }
        }
        msg.say('_Or type "start", to try another question._');
      });
  });
});

// question


// clue
slapp.message('^clue', ['direct_message'], (msg) => {
  console.log('User asks for a clue.');
  ApiHelper.getUser(msg.meta.user_id)
    .then((user) => {
      if (user.used_clues < 3) {
        ApiHelper.getCurrentQuestion(msg.meta.user_id)
          .then((question) => {
            if (question !== null) {
              console.log(question);
              console.log(question.clues[user.used_clues]);
              var clueIndex = user.used_clues+1;
              msg.say('Clue ' + clueIndex + ' out of 3:');
              msg.say(question.clues[user.used_clues]);
              ApiHelper.setCluesNumber(msg.meta.user_id, clueIndex);
            } else {
              msg.say('_Type "start", to guess a new question._');
            }
          });
      } else {
        msg.say('Sorry, no clues left for you. Ask around if you can find the answer.');
      }
    });
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

// help

slapp.action('register_callback', 'register_answer', (msg, value) => {
  var registerAnswer = 'Alright, then come back to me when you are ready!;';

  if (value === 'yes') {
    registerAnswer = 'Awesome here is a question for you:';
    ApiHelper.createUser(msg.meta.user_id)
      .then(() => {
        console.log('USER CREATED');
        ApiHelper.getRandomQuestion()
          .then((question) => {
            console.log('RANDOM QUESTION SELECTED' + question.question_id);
            ApiHelper.setCurrentQuestion(msg.meta.user_id, question.question_id)
              .then(() => {
                msg.say(question.question);
              });
          });
      });
  }

  var responseAnswer = {
    text: '',
    attachments: [{
      fallback: 'Do you want to register ?',
      title: 'Do you want to join the Akeneo Baby Foot Star League (ABSL) ?',
      text: registerAnswer,
      callback_id: 'register_callback',
      color: '#3AA3E3',
    }]
  };

  msg.respond(msg.body.response_url, responseAnswer);
});

// Question
slapp.message('^question', ['direct_message'], (msg) => {
  ApiHelper.getCurrentQuestion(msg.meta.user_id)
    .then((question) => {
      msg.say(question.question);
    });
});
//


//*********************************************
// Help handler
//*********************************************
slapp.message('help', ['mention', 'direct_message'], (msg) => {
  var HELP_TEXT = `
  Welcome to the Once Upon a time Akeneo quizz !
  \`help\` - to get some help.
  \`start\` - to start a quizz
  \`clue\` - to get a clue on your current research
  \`leaderboard\` - Show the leaderboard
  \`question\` - Show the current question
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

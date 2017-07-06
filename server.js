'use strict';

const express = require('express');
const Slapp = require('slapp');
const Utils = require('./Utils');
const ConvoStore = require('slapp-convo-beepboop');
const Context = require('slapp-context-beepboop');
const ApiHelper = require('./ApiHelper');

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
        console.log('About to get a random question');
        ApiHelper.getRandomQuestion()
          .then((question) => {
            ApiHelper.setCurrentQuestion(msg.meta.user_id, question.question_id)
              .then(() => {
                msg.say(question.question);
              });
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

// Random question
// find a random question user has not already answered
//ApiHelper.getRandomQuestion(userId).then((question) => {
//// reset user current_question and new progression
//ApiHelper.setCurrentQuestion(questionId)
//.then(() => {
//msg.say(question.question);
//});
//});
//[>**************************************************
////
//[>************************************************<]
//var sendMatchConfirmation = (msg, state) => {
//msg.say({
//channel: state.loserId,
//as_user: true,
//text: '',
//attachments: [{
//fallback: 'Match log confirmation',
//title: `Do you confirm that you lost ${state.winnerScore}-${state.loserScore} against <@${state.winnerId}> ?`,
//callback_id: 'match_confirmation_callback',
//color: '#3AA3E3',
//attachment_type: 'default',
//actions: [{
//name: 'match_confirmation_yes',
//text: 'Yep, good game.',
//style: 'primary',
//type: 'button',
//value: Utils.marshall({ state: state, value: 'yes' })
//},
//{
//name: 'match_confirmation_no',
//text: 'NO WAY ! That\' a lie!',
//type: 'button',
//value: Utils.marshall({ state: state, value: 'no' })
//}]
//}]
//});
//};

//var sendLeaderboard = (msg, playerId) => {
//ApiHelper.getRankings().then((rankings) => {
//var leaderBoard = rankings.sort((element1, element2) => {
//return element1.rank > element2.rank;
//});

//var leaderBoard = rankings.map((element) => {
//return element.rank + "- <@" + element.playerId + ">"
//});

//msg.say({
//channel: playerId,
//as_user: true,
//text: '*Leaderboard:*\n' + leaderBoard.join('\n')
//});
//});
//};

//var sendChallengers = (msg, playerId) => {
//ApiHelper.getChallengers(playerId).then((challengers) => {
//var messages = [];

//if (typeof(challengers.toBeat) !== 'undefined') {
//messages.push(':up: if you beat <@' + challengers.toBeat.playerId + '> ('+challengers.toBeat.rank+' th)');
//}

//if (typeof(challengers.notToLose) !== 'undefined') {
//messages.push(':down: if you lose against <@' + challengers.notToLose.playerId + '> ('+challengers.notToLose.rank+' th)');
//}

//msg.say({
//channel: playerId,
//as_user: true,
//text: '*List of challengers:*' + messages.join('\n')
//});
//});
//};

//*********************************************
// Register handler
//*********************************************
slapp.message('^.register', ['direct_message'], (msg) => {
  ApiHelper.isPlayerRegistered(msg.meta.user_id)
    .then((isRegistered) => {
      if (!isRegistered) {
        msg.say({
          text: '',
          attachments: [{
            fallback: 'Do you want to register ?',
            title: 'Do you want to join the Akeneo Baby Foot Star League (ABSL) ?',
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
        msg.say('You are already enrolled into the Akeneo Baby Foot Star League');
        msg.say('type .leaderboard to see who is the better players');
        msg.say('type .challengers to see who you need to beat to advance in the leaderboard');
      }
    })
    .catch(function(error) {
      // TODO: Send message if an error occured
    });
})

// Two != callbacks for this
slapp.action('register_callback', 'register_answer', (msg, value) => {
  var registerAnswer = '';

  if (value === 'yes') {
    registerAnswer = 'Awesome! let me register your account before you can start playing.';
    ApiHelper.registerPlayer(msg.meta.user_id);
  } else {
    registerAnswer = 'Alright, then come back to me when you are ready! :soccer:';
    // TODO: Call the helper route
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
  sendLeaderboard(msg, msg.meta.user_id);
  sendChallengers(msg, msg.meta.user_id);
});

//*********************************************
// Feature match logging: .win
//*********************************************
// TODO: Protected route
slapp.message('^.win <@([^>]+)> ([^>]+)\s*-\s*([^>]+)$', ['direct_message'], (msg, text, loserId, winnerScore, loserScore) => {
  var winnerId = msg.meta.user_id;
  winnerScore = Math.floor(parseInt(winnerScore, 10));
  loserScore = Math.floor(parseInt(loserScore, 10));

  var isInputError = false;
  var textResponse = [];

  // Parsing score values
  if (isNaN(winnerScore) || isNaN(loserScore)) {
    textResponse.push('The scores are not valid values.');
  } else {
    if (loserScore >= winnerScore) {
      isInputError = true;
      textResponse.push(`- Winner\'s score *(${winnerScore})* cannot be greater than the loser\'s score *(${loserScore})*.`);
    }
    if (winnerScore !== 10) {
      isInputError = true;
      textResponse.push(`- Winner\'s score *(${winnerScore})* should be 10.`);
    }
  }

  // Checking player's registration
  if (winnerId === loserId) {
    isInputError = true;
    textResponse.push('- Winner and loser cannot be the same user.');
  }

  ApiHelper.isPlayerRegistered(loserId)
    .then((isRegistered) => {
      if (isRegistered === false) {
        isInputError = true;
        textResponse.push(`- Losing player (<@${loserId}>) is not registered in the Akeneo Baby Foot League.`);
        // TODO: Show the list of user with the rankings
      }

      if (isInputError) {
        msg.say('Oups, an error occured while saving the game result.\n' + textResponse.join('\n'));
      } else {
        var state = {winnerId: winnerId, loserId: loserId, winnerScore, loserScore};
        msg
          .say(`Congratz for this huge win ! Let me check the result with <@${loserId}>.\n I'll come back to you when I'm done.`);
        sendMatchConfirmation(msg, state);
      }
    })
    .catch((error) => {
      console.log('An error occured while checking if the loserId is registered');
      console.log(error);
    });
});

slapp.action('match_confirmation_callback', 'match_confirmation_yes', (msg, args) => {
  args = Utils.unmarshall(args);

  if (typeof(args.state) !== 'undefined') {
    var state = args.state;
    ApiHelper.addMatchResult(state.winnerId, state.loserId, state.winnerScore, state.loserScore)
      .then(() => {
        msg.respond(msg.body.response_url, 'Ok, the match result has been successfully registered.');
        ApiHelper.refreshRank(state.winnerId, state.loserId)
          .then(() => {
            // Show leaderboard and challengers
            sendLeaderboard(msg, state.loserId);
            sendChallengers(msg, state.loserId);

            msg.say({
              channel: state.winnerId,
              as_user: true,
              text: `<@${state.loserId}> confirmed your victory :tada:. Good game.\nSee the *leaderboard* with \`.leaderboard\`\n or see who are your next *challengers* with \`.challengers\``
            });

            msg.say({
              channel: state.loserId,
              as_user: true,
              text: `See the *leaderboard* with \`.leaderboard\`\n or see who are your next *challengers* with \`.challengers\``
            });
          });
      });
  }
});

slapp.action('match_confirmation_callback', 'match_confirmation_no', (msg, args) => {
  args = Utils.unmarshall(args);

  if (typeof(args.state) !== 'undefined') {
    var state = args.state;
    msg.respond(msg.body.response_url, `Ok, You\'ll have to see this IRL with <@${state.winnerId}>`);
  }
});

//*********************************************
// Feature leaderboard
//*********************************************
slapp.message('^.leaderboard', ['mention', 'direct_message'], (msg, text) => {
  if (msg.isDirectMessage()) {
    sendLeaderboard(msg, msg.meta.user_id);
  } else if (msg.isMention()) {
    sendLeaderboard(msg, msg.meta.channel_id)
  }
})

slapp.message('^.my-games$', ['direct_message'], (msg, text) => {
  var playerId = msg.meta.user_id;
  ApiHelper.getPlayerGames(playerId).then((playerGames) => {
    playerGames = playerGames.map((game) => {
      var matchResult = '';
      var opponentId = '';

      if (game.winnerId === playerId) {
        matchResult += '*win*';
        opponentId = game.loserId;
      } else {
        matchResult += '*lost*';
        opponentId = game.winnerId;
      }

      var date = new Date(game.date);
      var dateDescription = date.getDate() + '/' + (date.getMonth()+1) + '/' + date.getFullYear();

      return `${dateDescription} - ${matchResult} against <@${opponentId}> ${game.winnerScore}-${game.loserScore}`;
    });

    msg.say({
      text: 'Here is the list of all the games you played:\n' + playerGames.join('\n')
    })
  });
});

slapp.message('^.last-games$', ['mention', 'direct_message'], (msg, text) => {
  ApiHelper.getGames().then((latestGames) => {
    latestGames = latestGames.map((game) => {
      var date = new Date(game.date);
      var dateDescription = date.getDate() + '/' + (date.getMonth()+1) + '/' + date.getFullYear();

      return `${dateDescription} - <@${game.winnerId}> won against <@${game.loserId}> ${game.winnerScore}-${game.loserScore}`;
    });

    msg.say({
      as_user: true,
      text: 'Here is the list of the last 15 games:\n' + latestGames.join('\n')
    })
  });
});

//*********************************************
// Feature challengers
//*********************************************
slapp.message('^.challengers', ['direct_message'], (msg, text) => {
  sendChallengers(msg, msg.meta.user_id);
});

//*********************************************
// Help handler .wcid
//*********************************************
slapp.message('help|.wcid', ['mention', 'direct_message'], (msg) => {
  var HELP_TEXT = `
  Hello, I'm Pierluigi the Akeneo Baby Foot referee. Here is the information I can provide you:
  \`help\` - to get some help.
    \`.register\` - to enroll in the baby footleague.
    \`.win <LOSING-PLAYER> <WINNER-SCORE>-<LOSER-SCORE>\` - to log a game result you have won.
    \`.leaderboard\` - Show the Baby foot leaderboard.
    \`.challengers\` - Show the next challengers you need to take on!
    \`.last-games\` - See the last 15 games results played in the league.
    \`.my-games\` - See all your games results in the baby foot league.
    `
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


const express = require('express'); // app server
const bodyParser = require('body-parser'); // parser for post requests
const AssistantV2 = require('ibm-watson/assistant/v2'); // watson sdk
const LanguageTranslatorV3 = require('ibm-watson/language-translator/v3');
const { IamAuthenticator, BearerTokenAuthenticator } = require('ibm-watson/auth');
const async = require("async");
const app = express();
const path = require('path');
const unirest = require('unirest');
const _ = require("underscore");
const { getRedZonesInfo } = require('./db.js');
const { STATE_CODES } = require('./stateCodes.js');
const { worldCasesData, countryCasesData, stateCasesData } = require('./getCovidCases.js')

let authenticator;
if (process.env.ASSISTANT_IAM_APIKEY) {
  authenticator = new IamAuthenticator({
    apikey: process.env.ASSISTANT_IAM_APIKEY
  });
} else if (process.env.BEARER_TOKEN) {
  authenticator = new BearerTokenAuthenticator({
    bearerToken: process.env.BEARER_TOKEN
  });
}

const assistant = new AssistantV2({
  version: '2019-02-28',
  authenticator: authenticator,
  url: process.env.ASSISTANT_URL,
  disableSslVerification: process.env.DISABLE_SSL_VERIFICATION === 'true' ? true : false
});

const languageTranslator = new LanguageTranslatorV3({
  authenticator: new IamAuthenticator({ apikey: process.env.LANGUAGE_TRANSLATOR_APIKEY }),
  url: process.env.LANGUAGE_TRANSLATOR_URL,
  version: '2020-04-21',
});


app.use(express.static('./public'));
app.use(bodyParser.json());

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname + '/public/chatui.html'));
});

var targetLanguage = '';
const categories = [
  "CoVID-19 Testing Lab",
  "Hospitals and Centers",
  "Police",
  "Government Helpline"
];
const publicServices = [
  "Free Food",
  "Fundraisers",
  "Delivery [Vegetables, Fruits, Groceries, Medicines, etc.]",
  "Senior Citizen Support",
  "Accommodation and Shelter Homes",
  "Transportation",
  "Community Kitchen"
];
var contextVariables = {};
var dataResources = [];

function translateLanguage(text, target) {
  return new Promise(function (resolve, reject) {
    languageTranslator.translate(
      {
        text: text,
        source: 'en',
        target: target
      }).then(function (results) {
        resolve(results.result.translations);
      })
      .catch(function (error) {
        reject(error);
      })
  })
}

const getResources = function() {
  unirest
  .get("https://api.covid19india.org/resources/resources.json")
  .headers({ 'Content-Type': 'application/json' })
  .then((response) => {
    dataResources = response.body.resources;
    dataResources.map(function (obj, index) {
    dataResources[index].statecode = (_.invert(STATE_CODES))[obj.state];
    })
  })
}

// Endpoint to be call from the client side
app.post('/api/message', function (req, res) {

  let assistantId;
  var textIn = '';

  if (req.body.bot) {
    assistantId = process.env[req.body.bot] || '<assistant-id>';
  }
  if (req.body && req.body.languagePreference) {
    targetLanguage = req.body.languagePreference;
  }
  if (req.body.input) {
    textIn = req.body.input.text;
  }

  if (!assistantId || assistantId === '<assistant-id>') {
    return res.json({
      output: {
        text:
          'The app has not been configured with a <b>ASSISTANT_ID</b> environment variable. Please refer to the ' +
          '<a href="https://github.com/watson-developer-cloud/assistant-simple">README</a> documentation on how to set this variable. <br>' +
          'Once a workspace has been defined the intents may be imported from ' +
          '<a href="https://github.com/watson-developer-cloud/assistant-simple/blob/master/training/car_workspace.json">here</a> in order to get a working application.',
      },
    });
  }

  var payload = {
    assistantId: assistantId,
    sessionId: req.body.session_id,
    input: {
      message_type: 'text',
      text: textIn,
      options: {
        'return_context': true
      }
    }
  };
  // Send the input to the assistant service
  assistant.message(payload, function (err, data) {
    if (err) {
      const status = err.code !== undefined && err.code > 0 ? err.code : 500;
      return res.status(status).json(err);
    }
    if (data.result.context.skills['main skill'].user_defined) contextVariables = data.result.context.skills['main skill'].user_defined;

    var dataTable = "<table style='width:100%'>" +
      "<tr style='padding-top:5px'>" +
      "<th>City</th>" +
      "<th>Category</th>" +
      "<th>Phone Number</th>" +
      "</tr>";
    if (contextVariables.Category == 'Emergency_Contact_Information') {
      if (contextVariables.StateCodes) {
        dataResources.map(function (obj1, index1) {
          categories.forEach(function (obj, index) {
            if (obj1.category == obj && obj1.statecode == contextVariables.StateCodes) {
              dataTable += "<tr>" +
                "<td>" + obj1.city + "</td>" +
                "<td>" + obj1.category + "</td>" +
                "<td>" + obj1.phonenumber + "</td>" +
                "</tr>"
              //dataTable1 += "<li>"+obj1.city+"        "+obj1.category+"        "+obj1.phonenumber+"</li><br/><br/>\n"
            }

          })
        })
        dataTable += "</table>";
        data.result.output.generic.push({ response_type: "text", text: dataTable });
      }
      //contextVariables = {};
    }

    if (contextVariables.Category == 'RedZones') {
      if (contextVariables.StateCodes) {
        const stateCode = contextVariables.StateCodes;
        getRedZonesInfo(stateCode).then(function (result) {
          if (result.error) {
            data.result.output.generic.push({ response_type: "text", text: "I did not understand that. Try to rephrase your sentence" });
          } else {
            var states = result.split(",");
            var dataObj = "Red Zones in " + STATE_CODES[stateCode] + ":<br/><br/>\n";
            states.map(function (state) {
              dataObj += "<li>" + state + "</li>\n"
            });
            //data.result.output.generic.push({ response_type: "text", text: dataObj });
             data.result.output.generic[0].response_type = "text";
             data.result.output.generic[0].text = dataObj;
            contextVariables = {};
            res.json(data);
          }
        })
        //contextVariables = {};
      }
    }
    if (contextVariables.Category == 'Covid_Case_Count') {
      if (contextVariables.Country_StateCodes) {
        const Country_StateCodes = contextVariables.Country_StateCodes.split("||");
        const Country = Country_StateCodes[0].length > 0 ? Country_StateCodes[0] : null;
        const State = Country_StateCodes[1].length > 0 ? Country_StateCodes[1] : null;
        if (Country && State) {
          if (Country.toUpperCase() == "INDIA") {
            var dataObj = "Covid cases in " + State + ":<br/><br/>\n" +
              "<li>Total Cases : " + stateCasesData[State].totalCases + "</li>\n" +
              "<li>Total Active : " + stateCasesData[State].totalActive + "</li>\n" +
              "<li>Total Recovered : " + stateCasesData[State].totalRecovered + "</li>\n" +
              "<li>Total Deaths : " + stateCasesData[State].totalDeaths + "</li>\n"
            data.result.output.generic.push({ response_type: "text", text: dataObj });
          } else {
            var dataObj = "I am under training. Please check with the states only under country " + Country;
            data.result.output.generic.push({ response_type: "text", text: dataObj });
          }
        }
        if (Country && !State) {
          var dataObj = "Covid cases in " + Country + ":<br/><br/>\n" +
            "<li>Total Cases : " + countryCasesData.totalCases + "</li>\n" +
            "<li>Today Cases : " + countryCasesData.todayCases + "</li>\n" +
            "<li>Total Active : " + countryCasesData.totalActive + "</li>\n" +
            "<li>Total Recovered : " + countryCasesData.totalRecovered + "</li>\n" +
            "<li>Total Deaths : " + countryCasesData.totalDeaths + "</li>\n" +
            "<li>Today Deaths : " + countryCasesData.todayDeaths + "</li>\n"
          data.result.output.generic.push({ response_type: "text", text: dataObj });
        }
        if (!Country && State) {
          var dataObj = "Covid cases in " + State + ":<br/><br/>\n" +
            "<li>Total Cases : " + stateCasesData[State].totalCases + "</li>\n" +
            "<li>Total Active : " + stateCasesData[State].totalActive + "</li>\n" +
            "<li>Total Recovered : " + stateCasesData[State].totalRecovered + "</li>\n" +
            "<li>Total Deaths : " + stateCasesData[State].totalDeaths + "</li>\n"
          data.result.output.generic.push({ response_type: "text", text: dataObj });
        }
      } else {
        var dataObj = "Worldwide covid cases:<br/><br/>\n" +
          "<li>Total Cases : " + worldCasesData.totalCases + "</li>\n" +
          "<li>Today Cases : " + worldCasesData.todayCases + "</li>\n" +
          "<li>Total Active : " + worldCasesData.totalActive + "</li>\n" +
          "<li>Total Recovered : " + worldCasesData.totalRecovered + "</li>\n" +
          "<li>Total Deaths : " + worldCasesData.totalDeaths + "</li>\n" +
          "<li>Today Deaths : " + worldCasesData.todayDeaths + "</li>\n" +
          "<li>Affected Countries : " + worldCasesData.affectedCountries + "</li>\n"
        data.result.output.generic.push({ response_type: "text", text: dataObj });
      }
    //  contextVariables = {};
    }
    if (contextVariables.Category == 'Public_Services') {
      if (contextVariables.StateCodes) {
        dataResources.map(function (obj1, index1) {
          publicServices.forEach(function (obj, index) {
            if (obj1.category == obj && obj1.statecode == contextVariables.StateCodes) {
              dataTable += "<tr>" +
                "<td>" + obj1.city + "</td>" +
                "<td>" + obj1.category + "</td>" +
                "<td>" + obj1.phonenumber + "</td>" +
                "</tr>"
              //dataTable1 += "<li>"+obj1.city+"        "+obj1.category+"        "+obj1.phonenumber+"</li><br/><br/>\n"
            }

          })
        })
        dataTable += "</table>";
        data.result.output.generic.push({ response_type: "text", text: dataTable });
      }
      //contextVariables = {};
    }
    if (targetLanguage != "en") {
      var generic = data.result.output.generic;
      async.parallel({
        text: function (callback) {
          var textCount = 0;
          var nonTextCount = 0;
          generic.forEach(function (gen, index) {
            if (gen.hasOwnProperty('text')) {
              translateLanguage(gen.text, targetLanguage).then(function (result) {
                data.result.output.generic[index].text = result[0].translation;
                textCount++;
                if ((nonTextCount + textCount) == generic.length) {
                  callback(null, "success");
                }
              })
            }
            else {
              nonTextCount++;
              if ((nonTextCount + textCount) == generic.length) {
                callback(null, "success");
              }
            }
          })
        },
        title: function (callback) {
          var titleCount = 0;
          var nonTitleCount = 0;
          generic.forEach(function (gen, index) {
            if (gen.hasOwnProperty('title')) {
              translateLanguage(gen.title, targetLanguage).then(function (response) {
                data.result.output.generic[index].title = response[0].translation;
                titleCount++;
                if ((titleCount + nonTitleCount) == generic.length) {
                  callback(null, "success");
                }
              });
            }
            else {
              nonTitleCount++;
              if ((titleCount + nonTitleCount) == generic.length) {
                callback(null, "success");
              }
            }
          })
        },
        options: function (callback) {
          var labels = [];
          var optionsCount = 0;
          var nonOptionsCount = 0;
          generic.forEach(function (gen, index) {
            if (gen.hasOwnProperty('options')) {
              gen.options.map(function (obj, i) {
                labels[i] = obj.label;
                if (labels.length == gen.options.length) {
                  translateLanguage(labels, targetLanguage).then(function (response) {
                    response.forEach(function (obj, j) {
                      data.result.output.generic[index].options[j].label = obj.translation;
                      if (j == (response.length - 1)) {
                        optionsCount++;
                        if ((optionsCount + nonOptionsCount) == generic.length) {
                          callback(null, "success");
                        }
                      }
                    })

                  })
                }
              })

            }
            else {
              nonOptionsCount++;
              if ((optionsCount + nonOptionsCount) == generic.length) {
                callback(null, "success");
              }
            }
          })
        }
      }, function (err, result) {
        return res.json(data);
      })
    }
    else {
      if (contextVariables.Category == 'RedZones' && contextVariables.StateCodes != null) { }
      else {
        contextVariables = {};
        res.json(data)
      };
    }
  });
});
app.get('/api/session', function (req, res) {
  let assistantId;
  if (req.query.bot) {
    assistantId = process.env[req.query.bot];
  }

  assistant.createSession(
    {
      assistantId: assistantId || '{assistant_id}',
    },
    function (error, response) {
      if (error) {
        return res.send(error);
      } else {
        return res.send(response);
      }
    }
  );
});
getResources();
setInterval(getResources, 3600000);
module.exports = app;

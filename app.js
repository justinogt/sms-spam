const express = require('express');
const compression = require('compression');
const fs = require('fs');
const natural = require('natural');

const _port = 8080;
const _app_folder = 'public';

const app = express();
app.use(compression());

// Read CSV
const REGEX_COLUMNS = /".*?[^"]",|".+?",|"[^"]"|[^,]+/g;
const REGEX_REPLACE_QUOTES = /^"|"$|",$/gms;
function parseSMSCSV(csvContent) {
  if (!csvContent) return[];

  const rawData = [];
  const lines = csvContent.split('\n');
  const commonWords = lines[0].match(REGEX_COLUMNS).slice(1, 150).map(word => word.replace(REGEX_REPLACE_QUOTES, ''));

  for (const line of lines.slice(1)) {
    if (!line) continue;

    const columns = line.match(REGEX_COLUMNS);
    rawData.push({
      fullText: columns[0].replace(REGEX_REPLACE_QUOTES, ''),
      commonWords: columns.slice(1, 150).map((hasWord, index) => hasWord === '1' ? commonWords[index] : '0').filter(word => word !== '0'),
      commonWordsCount: Number(columns[150]),
      wordCount: Number(columns[151]),
      date: new Date(columns[152]),
      isSpam: columns[153].trim().replace(REGEX_REPLACE_QUOTES, '') === 'no' ? false : true
    });;
  }

  return rawData;
}
const csvContent = fs.readFileSync('sms_senior.csv').toString();
const smsRaw = parseSMSCSV(csvContent);

(async function() {
  // Train Natural Naive Bayes
  let classifier = new natural.BayesClassifier();
  try {
    classifier = await new Promise((resolve, reject) => {
      natural.BayesClassifier.load('classifier.json', null, function(err, classifier) {
        if (err) reject(err);
        else resolve(classifier);
      });
    });
  } catch {
    classifier = new natural.BayesClassifier();
    for (const sms of smsRaw) classifier.addDocument(sms.fullText, sms.isSpam ? 'spam' : 'comum');
    classifier.train();
    classifier.save('classifier.json');
  }

  // Calculate Naive's Bayes performance against database
  // let naivesBayesResult = [];
  // for (const sms of smsRaw) {
  //   naivesBayesResult.push(classifier.classify(sms.fullText));
  // }

  // const naivesBayesPerformance = {
  //   database: {
  //     common: smsRaw.filter(item => !item.isSpam).length,
  //     spam: smsRaw.filter(item => item.isSpam).length
  //   },
  //   classifier: {
  //     common: naivesBayesResult.filter(item => item == 'comum').length,
  //     spam: naivesBayesResult.filter(item => item == 'spam').length
  //   }
  // };
  // console.log(naivesBayesPerformance);

  // API
  app.get('/getSMSRawData', (req, res) => res.send(JSON.stringify(smsRaw)));
  app.get('/classify', (req, res) => res.send(JSON.stringify(classifier.classify(req.query.message))));

  app.get('*.*', express.static(_app_folder, { maxAge: '1y' }));
  app.all('*', (req, res) => res.status(200).sendFile(`/`, { root: _app_folder }));

  app.listen(_port, () => console.log('Node server for ' + app.name + ' listening on http://localhost:' + _port));
})();
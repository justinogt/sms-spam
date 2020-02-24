const REGEX_COLUMNS = /".*?[^"]",|".+?",|"[^"]"|[^,]+/g;
const REGEX_REPLACE_QUOTES = /^"|"$|",$/gms;

function getMonthYear(date) { return `${date.getMonth() + 1}/${date.getFullYear()}`; }
function median(arr) {
  if (arr.length == 0) return 0;
  arr.sort((a, b) => a-b);
  const half = Math.floor(arr.length / 2);
  if (arr.length % 2) return arr[half];
  return (arr[half - 1] + arr[half]) / 2.0;
}
function reduceCommonWords(arr, item) {
  for (const word of item.commonWords) {
    let data = arr.find(dItem => dItem.word === word);
    if (!data) {
      data = { word, weight: 0 };
      arr.push(data);
    }
    data.weight += 1;
  }
  return arr;
}

const fileInput = document.getElementById('fileInput');
const generateStatistics = document.getElementById('generateStatistics');

generateStatistics.addEventListener('click', () => {
  const file = fileInput.files.length > 0 ? fileInput.files[0] : null;
  if (file === null) {
    alert('Selecione o arquivo .csv');
    return;
  }
  const reader = new FileReader();
  reader.onload = ev => loadedCSV(ev.target.result);
  reader.readAsText(file, 'utf-8');
});

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

function createBarChart(cardId, title, labels, datasets) {
  const ctx = document.querySelector(cardId + ' canvas').getContext('2d');
  return new Chart(ctx, {
    type: 'bar', data: { labels, datasets },
    options: {
      responsive: true,
      legend: { position: 'top' },
      title: { display: true, text: title }
    }
  });
}

function cardFrequentWords(smsRawData) {
  const frequentWords = smsRawData.reduce(reduceCommonWords, []).sort((a, b) => b.weight - a.weight);
  
  const labels = frequentWords.map(item => item.word);
  const chartData = frequentWords.map(item => item.weight);

  const chart = createBarChart('#cardfrequentWords', 'Palavras Mais Frequentes',
    labels.slice(0, 25), [{ label: 'Palavras Frequentes', data: chartData.slice(0, 25), backgroundColor: 'rgba(65, 65, 255, .85)' }]);

  $('#cardfrequentWords .slider').ionRangeSlider({
    min: Math.min(25, frequentWords.length),
    max: frequentWords.length,
    onFinish: data => {
      chart.data.labels = labels.slice(0, data.from);
      chart.data.datasets.forEach(dataset => dataset.data = chartData.slice(0, data.from));
      chart.update();
    }
  });
}

function cardCommonSpamSMS(smsRawData) {
  const commonSpamSMS = smsRawData.reduce((acc, item) => {
    const monthYear = getMonthYear(item.date);
    const type = item.isSpam ? 'spam' : 'common';

    let data = acc.find(tItem => tItem.type == type && tItem.monthYear == monthYear);
    if (!data) {
      data = { type, monthYear, count: 0 };
      acc.push(data);
    }
    data.count += 1;
    return acc;
  }, []);

  const labels = commonSpamSMS.map(item => item.monthYear)
    .filter((item, index, self) => self.indexOf(item) == index);
  const chartDataCommon = labels.map(label => {
    const data = commonSpamSMS.find(tItem => tItem.type == 'common' && tItem.monthYear == label);
    return data ? data.count : 0;
  });
  const chartDataSpam = labels.map(label => {
    const data = commonSpamSMS.find(tItem => tItem.type == 'spam' && tItem.monthYear == label);
    return data ? data.count : 0;
  });

  const chart = createBarChart('#cardCommonSpamSMS', 'Mensagens Comuns e Spams',
    labels, [
      { label: 'Comuns', data: chartDataCommon, backgroundColor: 'rgba(65, 65, 255, .85)' },
      { label: 'Spams', data: chartDataSpam, backgroundColor: 'rgba(255, 65, 65, .85)' }
    ]);
}

function cardMinMaxWordCount(smsRawData) {
  const smsData = smsRawData.reduce((acc, item) => {
    const monthYear = getMonthYear(item.date);

    let data = acc.find(tItem => tItem.monthYear == monthYear);
    if (!data) {
      data = { 
        monthYear, max: -Infinity, min: Infinity
      };
      acc.push(data);
    }

    data.max = Math.max(data.max, item.wordCount);
    data.min = Math.min(data.min, item.wordCount);
    return acc;
  }, []);

  const labels = smsData.map(item => item.monthYear)
    .filter((item, index, self) => self.indexOf(item) == index);
  const chartDataMin = labels.map(label => {
    const data = smsData.find(tItem => tItem.monthYear == label);
    return data ? data.min : 0;
  });
  const chartDataMax = labels.map(label => {
    const data = smsData.find(tItem => tItem.monthYear == label);
    return data ? data.max : 0;
  });

  const chart = createBarChart('#cardMinMaxWordCount', 'Minima e Máxima de Palavras por Mensagens',
    labels, [
      { label: 'Minima', data: chartDataMin, backgroundColor: 'rgba(65, 65, 255, .85)' },
      { label: 'Máxima', data: chartDataMax, backgroundColor: 'rgba(255, 65, 65, .85)' }
    ]);
}

function cardAverageWordCount(smsRawData) {
  const smsData = smsRawData.reduce((acc, item) => {
    const monthYear = getMonthYear(item.date);

    let data = acc.find(tItem => tItem.monthYear == monthYear);
    if (!data) {
      data = { 
        monthYear, wordsCount: [], average: 0, standardDeviation: 0,
        variance: 0
      };
      acc.push(data);
    }

    data.wordsCount.push(item.wordCount);
    data.average += item.wordCount;

    return acc;
  }, []).map(item => {
    item.average /= item.wordsCount.length;
    item.median = median(item.wordsCount);
    item.variance = item.wordsCount.reduce((acc, count) => acc + Math.pow((count - item.average), 2), 0) / (item.wordsCount.length - 1);
    item.standardDeviation = Math.sqrt(item.variance);
    return item;
  });

  const labels = smsData.map(item => item.monthYear)
    .filter((item, index, self) => self.indexOf(item) == index);
  const chartDataAverage = labels.map(label => {
    const data = smsData.find(tItem => tItem.monthYear == label);
    return data ? data.average : 0;
  });
  const chartDataMedian = labels.map(label => {
    const data = smsData.find(tItem => tItem.monthYear == label);
    return data ? data.median : 0;
  });
  const chartDataVariance = labels.map(label => {
    const data = smsData.find(tItem => tItem.monthYear == label);
    return data ? data.variance : 0;
  });
  const chartDataStandardDeviation = labels.map(label => {
    const data = smsData.find(tItem => tItem.monthYear == label);
    return data ? data.standardDeviation : 0;
  });

  const chart = createBarChart('#cardAverageWordCount', 'Médias da Quantidade de Palavras por Mensagens',
    labels, [
      { label: 'Média Total', data: chartDataAverage, backgroundColor: 'rgba(65, 65, 255, .85)' },
      { label: 'Mediana', data: chartDataMedian, backgroundColor: 'rgba(255, 65, 65, .85)' },
      { label: 'Variância', data: chartDataVariance, backgroundColor: 'rgba(65, 255, 65, .85)' },
      { label: 'Desvio Padrão', data: chartDataStandardDeviation, backgroundColor: 'rgba(100, 150, 65, .85)' }
    ]);
}

function cardSequencyCommonSpamMessages(smsRawData) {
  let lastDay = null;
  let lastIsSpam = null;
  let lastData = null;
  let sequencyCount = 0;
  const smsData = smsRawData.reduce((acc, item) => {
    const day = item.date.toLocaleDateString();
    let data = acc.find(tItem => tItem.day == day);
    if (!data) {
      data = { day, date: item.date, sequencyCommon: -Infinity, sequencySpam: -Infinity };
      acc.push(data);
    }

    if (lastDay != null && (day != lastDay || item.isSpam != lastIsSpam)) {
      if (lastIsSpam && sequencyCount > lastData.sequencySpam)
        lastData.sequencySpam = sequencyCount;
      else if (!lastIsSpam && sequencyCount > lastData.sequencyCommon)
        lastData.sequencyCommon = sequencyCount;
      sequencyCount = 1;
    }
    else
      sequencyCount++;

    lastData = data;
    lastDay = day;
    lastIsSpam = item.isSpam;
    return acc;
  }, []).reduce((acc, item) => {
    const monthYear = getMonthYear(item.date);
    let data = acc.find(tItem => tItem.monthYear == monthYear);
    if (!data) {
      data = { monthYear, day: item.day, sequency: 0 };
      acc.push(data);
    }

    if (item.sequencyCommon > data.sequency) {
      data.day = item.day;
      data.sequency = item.sequencyCommon;
    }

    return acc;
  }, []);

  const labels = smsData.map(item => item.day)
    .filter((item, index, self) => self.indexOf(item) == index);
  const chartData = labels.map(label => {
    const data = smsData.find(tItem => tItem.day == label);
    return data ? data.sequency : 0;
  });

  const chart = createBarChart('#cardSequencyCommonSpamMessages', 'Maior Sequência de Mensagens Comuns',
    labels, [
      { label: 'Sequência', data: chartData, backgroundColor: 'rgba(65, 65, 255, .85)' }
    ]);
}

function cardWordsCloud(element, smsMessages) {
  const words = smsMessages.reduce(reduceCommonWords, []);
  element.jQCloud(words.map(item => ({...item, text: item.word})), {
    fontSize: {
      from: 0.1,
      to: 0.02
    }
  });
}

function loadedCSV(csvContent) {
  const smsRawData = parseSMSCSV(csvContent)
    .sort((a, b) => a.date - b.date);

  cardFrequentWords(smsRawData);
  cardCommonSpamSMS(smsRawData);
  cardMinMaxWordCount(smsRawData);
  cardAverageWordCount(smsRawData);
  cardSequencyCommonSpamMessages(smsRawData);
  cardWordsCloud($('#cardCommonWordsCloud .words-cloud'), smsRawData.filter(item => !item.isSpam));
  cardWordsCloud($('#cardSpamWordsCloud .words-cloud'), smsRawData.filter(item => item.isSpam));
}
const REGEX_COLUMNS = /"[^"]+"|[^,]+/g;
const REGEX_REPLACE_QUOTES = /^"|"$/g;

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
  const commonWords = lines[0].match(REGEX_COLUMNS).slice(1, 149);

  for (const line of lines.slice(1)) {
    if (!line) continue;

    const columns = line.match(REGEX_COLUMNS);
    rawData.push({
      fullText: columns[0].replace(REGEX_REPLACE_QUOTES, ''),
      commonWords: columns.slice(1, 149).map((hasWord, index) => hasWord === '1' ? commonWords[index].replace(REGEX_REPLACE_QUOTES, '') : '0').filter(word => word !== '0'),
      commonWordsCount: Number(columns[150]),
      wordCount: Number(columns[151]),
      date: new Date(columns[152]),
      isSpam: columns[153].replace(REGEX_REPLACE_QUOTES, '') === 'no' ? false : true
    });
  }

  return rawData;
}

function loadedCSV(csvContent) {
  console.log(parseSMSCSV(csvContent)[0]);
}
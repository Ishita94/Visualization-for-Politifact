/**
 * Load data from CSV file asynchronously and render charts
 */
let data;
let scatterPlot; let stackedAreaChart; let stackedBarChart;
let selectedSourceListGlobal = [];
let selectedPointListGlobal = [];
let selectedDateRangeGlobal = [null, null];

// Initialize dispatcher that is used to orchestrate events

const dispatcher = d3.dispatch('filterbySelectedPoints', 'filterbySelectedDateRange', 'filterStatementSource');

const verdictmap = [{ name: 'Pants-fire', verdict: '0' },
  { name: 'False', verdict: '1' },
  { name: 'Mostly False', verdict: '2' },
  { name: 'Half True', verdict: '3' },
  { name: 'Mostly True', verdict: '4' },
  { name: 'True', verdict: '5' },
];

const statementSourcesMap = [{ originalName: 'speech', newName: 'Speech' },
  { originalName: 'television', newName: 'Television' },
  { originalName: 'news', newName: 'News' },
  { originalName: 'blog', newName: 'Blog' },
  { originalName: 'social_media', newName: 'Social Media' },
  { originalName: 'advertisement', newName: 'Advertisement' },
  { originalName: 'campaign', newName: 'Campaign' },
  { originalName: 'meeting', newName: 'Meeting' },
  { originalName: 'radio', newName: 'Radio' },
  { originalName: 'email', newName: 'Email' },
  { originalName: 'testimony', newName: 'Testimony' },
  { originalName: 'statement', newName: 'Statement' },
  { originalName: 'other', newName: 'Other' },
];
// Initialize color scheme for the verdicts
const colorScale = d3
  .scaleDiverging(d3.interpolateRdYlGn)
  .clamp(true);
colorScale.domain([0.0, 2.5, 5.0]);

$('#fromDate').datepicker({
  changeMonth: true,
  changeYear: true,
  showButtonPanel: true,
  onClose(dateText, inst) {
    const startDate = new Date(inst.selectedYear, inst.selectedMonth, inst.selectedDay);
    selectedDateRangeGlobal[0] = startDate;
    if (selectedDateRangeGlobal[1] !== null) {
      dispatcher.call('filterbySelectedDateRange', event, [selectedDateRangeGlobal[0], selectedDateRangeGlobal[1]]);
    }
  },
});
$('#toDate').datepicker({
  changeMonth: true,
  changeYear: true,
  showButtonPanel: true,
  onClose(dateText, inst) {
    const endDate = new Date(inst.selectedYear, inst.selectedMonth, inst.selectedDay);
    selectedDateRangeGlobal[1] = endDate;
    if (selectedDateRangeGlobal[0] !== null) {
      dispatcher.call('filterbySelectedDateRange', event, [selectedDateRangeGlobal[0], selectedDateRangeGlobal[1]]);
    }
  },
});

const parseTime = d3.timeParse('%m/%d/%Y');

d3.csv('data/politifact_filtered.csv').then((_data) => {
  data = _data;

  $('#toDate').datepicker().value = '';
  $('#fromDate').datepicker().value = '';

  restartQuizPanel(data);

  scatterPlot = new ScatterPlot({
    parentElement: '#scatterplotContainer',
  }, dispatcher, data);

  stackedBarChart = new StackedBarChart({
    parentElement: '#stacked-bar-chart',
  }, dispatcher, data);

  stackedAreaChart = new StackedAreaChart({
    parentElement: '#area-chart',
  }, dispatcher, data);

  selectedSourceListGlobal = [];
  selectedPointListGlobal = [];
  selectedDateRangeGlobal = [];

  handleStatementGameContainer(data);

  scatterPlot.updateVis();
  stackedBarChart.updateVis();
  stackedAreaChart.updateVis();
}).catch((error) => console.error(error));

function filterDatabySelectedOriginators(array) {
  const originatorList = selectedPointListGlobal.map((d) => d.statement_originator);
  if (originatorList.length > 0) return array.filter((d) => originatorList.includes(d.statement_originator));
  return array;
}
function filterDatabySources(array) {
  if (selectedSourceListGlobal.length > 0) return array.filter((d) => selectedSourceListGlobal.includes(d.statement_source));
  return array;
}
function filterDatabySelectedDateRange(array) {
  // selectedDateRangeGlobal not null, undefined, empty
  if (selectedDateRangeGlobal && Array.isArray(selectedDateRangeGlobal) && selectedDateRangeGlobal.length) {
    return array.filter((d) => {
      const current_statement_date = parseTime(d.statement_date);
      return current_statement_date >= selectedDateRangeGlobal[0] && current_statement_date <= selectedDateRangeGlobal[1];
    });
  }
  return array;
}

function updateGlobalArrays(array) {
  // If the originator does not exist after the change but it was selected before selection->
  // remove it from selectedpointsglobal
  const originatorList = array.map((d) => d.statement_originator);
  let newglobalarray = [];
  if (selectedPointListGlobal.length > 0) {
    if (originatorList.length > 0) {
      newglobalarray = selectedPointListGlobal.filter((d) => {
        const name = d.statement_originator;
        const isSelected = originatorList.find((g) => g.statement_originator === name);

        let shouldbeSelected = false;
        if (isSelected !== undefined) shouldbeSelected = true;

        // if true, make it selected, if false, remove selected class
        const pointElement = document.getElementById(d.statement_originator);
        if (shouldbeSelected) pointElement.className = 'point selected';
        else pointElement.className = 'point';
        return shouldbeSelected; // if true, include in selectedpointsglobal, if false, remove
      });
    } else {
      Array.prototype.forEach.call(
        document.getElementsByClassName('point.selected'),
        (d) => {
          d.classList.remove('selected'); // clear selection of all selected points
        },
      );
    }
    selectedPointListGlobal = newglobalarray;
    // Array.prototype.forEach.call(selectedPointListGlobal, function (d){
    //   var pointElement = document.getElementById(d.statement_originator);
    //   pointElement
    // })
  }
  // If the source does not exist after the change but it was selected before selection from bar chart
  // source button -> remove it from selectedSourceListGlobal
  const sourceList = array.map((d) => d.statement_source);
  newglobalarray = [];
  if (selectedSourceListGlobal.length > 0) {
    if (sourceList.length > 0) {
      newglobalarray = selectedSourceListGlobal.filter((d) => {
        const shouldbeSelected = sourceList.includes(d);
        return shouldbeSelected; // if true, include in selectedSourceListGlobal, if false, remove
      });
    } else {
      Array.prototype.forEach.call(
        document.getElementsByClassName('source.selected'),
        (d) => {
          d.classList.remove('selected'); // clear selection of all selected bars
        },
      );
      Array.prototype.forEach.call(
        document.getElementsByClassName('sourcebutton.selected'),
        (d) => {
          d.classList.remove('selected'); // clear selection of all selected bars
        },
      );
    }

    selectedSourceListGlobal = newglobalarray;
  }
  // TODO: any situation related to selectedDateRange?
}

// dispatcher functions
dispatcher.on('filterbySelectedPoints', (selectedPoints) => {
  selectedPointListGlobal = selectedPoints;
  // need to filter data and update data of all other visualizations
  let filteredData = filterDatabySelectedOriginators(data);
  filteredData = filterDatabySelectedDateRange(filteredData);
  stackedBarChart.data = filteredData;
  stackedBarChart.updateVis();
  filteredData = filterDatabySources(filteredData);
  scatterPlot.data = filteredData;

  stackedAreaChart.data = filteredData;

  const descriptionText = document.getElementById('textforStatementSummary');
  descriptionText.innerHTML = `, number of filtered statements is ${filteredData.length}`;

  stackedAreaChart.updateVis();
  restartQuizPanel(filteredData);
});

dispatcher.on('filterStatementSource', (selectedSources) => {
  selectedSourceListGlobal = selectedSources;
  let filteredData = filterDatabySelectedOriginators(data);
  filteredData = filterDatabySources(filteredData);
  filteredData = filterDatabySelectedDateRange(filteredData);
  scatterPlot.data = filteredData;

  stackedAreaChart.data = filteredData;

  const descriptionText = document.getElementById('textforStatementSummary');
  descriptionText.innerHTML = `, number of filtered statements is ${filteredData.length}`;

  scatterPlot.updateVis();
  stackedAreaChart.updateVis();
  restartQuizPanel(filteredData);
});

dispatcher.on('filterbySelectedDateRange', (selectedDateRange) => {
  selectedDateRangeGlobal = selectedDateRange;
  let filteredData = filterDatabySelectedOriginators(data);
  filteredData = filterDatabySelectedDateRange(filteredData);
  stackedBarChart.data = filteredData;
  stackedBarChart.updateVis();
  filteredData = filterDatabySources(filteredData);
  scatterPlot.data = filteredData;

  stackedAreaChart.data = filteredData;

  const descriptionText = document.getElementById('textforStatementSummary');
  descriptionText.innerHTML = `, number of filtered statements is ${filteredData.length}`;

  scatterPlot.updateVis();
  stackedAreaChart.updateVis();
  restartQuizPanel(filteredData);
});

function selectSourceButton(element) {
  const isAlreadySelected = element.classList.contains('selected');
  if (isAlreadySelected) {
    element.classList.remove('selected');
  } else {
    element.classList.add('selected');
  }

  let filteredData = filterDatabySelectedOriginators(data);
  filteredData = filterDatabySelectedDateRange(filteredData);
  stackedBarChart.data = filteredData;
  stackedBarChart.updateVis();
}

function handleClickofSourceButton(element) {
  // TODO: need to filter data, update global array for sources, and call updateVis on all view
  // var filteredDatabySource = getFilteredDatabySource(data, "statement_source", element.innerText.toLowerCase());
  // filterDataandUpdateVisTemp(filteredDatabySource);

  const statementSource = statementSourcesMap.find((d) => (element.classList.contains(d.originalName))).originalName;
  selectedSources = stackedBarChart.toggleBarDisplay(statementSource);
  dispatcher.call('filterStatementSource', event, selectedSources);
  selectSourceButton(element);
}

const gameContainer = document.getElementById('statementGameContainer');
const randomStatementTextArea = document.getElementById('random-statement');
const verdictDropdown = document.getElementById('verdict-dropdown');
const verdictSelector = document.getElementById('verdict-selector');
const checkAnswerButton = document.getElementById('check-answer-button');
const tryAgainButton = document.getElementById('try-again-button');
const selectedAnswerText = document.getElementById('selected-answer-text');
const correctAnswerText = document.getElementById('correct-answer-text');
const descriptionText = document.getElementById('description-of-chosen-statement');

checkAnswerButton.addEventListener('click', changeToSolutionMode);
tryAgainButton.addEventListener('click', changeToQuizMode);
let correctAnswerData;
let quizData;
function restartQuizPanel(_data) {
  quizData = _data;
  changeToQuizMode();
  // Change to screen containing the quiz solution and the origin of the statement
}

function handleStatementGameContainer(data) {
  const gameContainer = document.getElementById('statementGameContainer');
  const randomStatementTextArea = document.getElementById('random-statement');
  const verdictDropdown = document.getElementById('verdict-dropdown');
  const verdictSelector = document.getElementById('verdict-selector');
  const checkAnswerButton = document.getElementById('check-answer-button');
  const tryAgainButton = document.getElementById('try-again-button');
  const selectedAnswerText = document.getElementById('selected-answer-text');
  const correctAnswerText = document.getElementById('correct-answer-text');
  const descriptionText = document.getElementById('description-of-chosen-statement');

  checkAnswerButton.addEventListener('click', changeToSolutionMode);
  tryAgainButton.addEventListener('click', changeToQuizMode);
  let correctAnswerData;
  changeToQuizMode();
  // Change to screen containing the quiz solution and the origin of the statement
}

function changeToSolutionMode() {
  // Change the colour of the quiz panel based on the correct verdict
  if (correctAnswerData !== null) {
    gameContainer.style.backgroundColor = colorScale(correctAnswerData.verdict);
  }

  verdictSelector.disabled = true;
  checkAnswerButton.disabled = true;
  checkAnswerButton.style.opacity = 0;
  tryAgainButton.disabled = false;
  tryAgainButton.style.opacity = 1;
  verdictDropdown.style.opacity = 0;
  randomStatementTextArea.style.maxHeight = '50px';
  selectedAnswerText.style.opacity = 1;
  correctAnswerText.style.opacity = 1;
  descriptionText.style.opacity = 1;
  // Set the check answer button to be behind of the try again button
  checkAnswerButton.style.zIndex = '0';
  tryAgainButton.style.zIndex = '1';
  selectedAnswerText.innerHTML = `You selected: ${verdictmap.find((d) => d.verdict === verdictSelector.value).name}`;
  if (correctAnswerData !== null) {
    correctAnswerText.innerHTML = `The correct answer is: ${verdictmap.find((d) => d.verdict === correctAnswerData.verdict).name}`;
    const description = `Statement Originator: ${correctAnswerData.statement_originator}<br/>
          Statement Date: ${correctAnswerData.statement_date}<br/>
          Fact-Check Date: ${correctAnswerData.factcheck_date}<br/>
          Fact-Checker: ${correctAnswerData.factchecker}<br/>
          Statement Source: ${statementSourcesMap.find((d) => d.originalName === correctAnswerData.statement_source).newName}<br/>
          Link: <a href="${correctAnswerData.factcheck_analysis_link}" target="_blank" rel="noopener noreferrer">Click here to know more<a/>`;
      // Displays the facts/origin of the statement shown
    descriptionText.innerHTML = description;
  } else {
    correctAnswerText.innerHTML = 'N/A';
    descriptionText.innerHTML = 'N/A';
  }
}

// Change to screen quizzing the user where the user can select a verdict
function changeToQuizMode() {
  gameContainer.style.backgroundColor = 'grey';
  verdictSelector.disabled = false;
  checkAnswerButton.disabled = false;
  checkAnswerButton.style.opacity = 1;
  tryAgainButton.disabled = true;
  tryAgainButton.style.opacity = 0;
  verdictDropdown.style.opacity = 1;
  descriptionText.style.opacity = 0;
  descriptionText.innerHTML = '';
  randomStatementTextArea.style.maxHeight = '100px';
  selectedAnswerText.style.opacity = 0;
  correctAnswerText.style.opacity = 0;
  // Set the check answer button to be in front of the try again button
  checkAnswerButton.style.zIndex = '1';
  tryAgainButton.style.zIndex = '0';
  // Select a random integer between 0 and the total number of statements in data
  const randomIndex = Math.floor(Math.random() * quizData.length);
  if (quizData.length < 1) {
    randomStatementTextArea.innerHTML = 'No statements to display because there is no data avaliable according to the current filters.';
    correctAnswerData = null;
  } else {
    correctAnswerData = quizData[randomIndex];
    // Display the randomly selected statement in a textfield
    randomStatementTextArea.innerHTML = correctAnswerData.statement;
  }
}

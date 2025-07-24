class StackedBarChart {
  /**
     * Class constructor with basic chart configuration
     * @param {Object}
     * @param {Array}
     */
  constructor(_config, _dispatcher, _data) {
    this.config = {
      parentElement: _config.parentElement,
      containerWidth: 400,
      containerHeight: 400,
      margin: {
        top: 5, right: 30, bottom: 50, left: 90,
      },
      maxHorizontalAxisValue: 5000,
      tooltipPadding: _config.tooltipPadding || 15,
    };
    this.dispatcher = _dispatcher;
    this.data = _data;
    this.initVis();
  }

  /**
     * Initialize scales/axes and append static chart elements
     */
  initVis() {
    const vis = this;

    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    vis.xScale = d3.scaleLinear()
      .range([0, vis.width]);

    vis.yScale = d3.scaleBand()
      .padding(0.2)
      .range([0, vis.height]);

    vis.colorScale = d3
      .scaleDiverging(d3.interpolateRdYlGn)
      .clamp(true);

    // Initialize axes
    vis.xAxis = d3.axisBottom(vis.xScale)
      .ticks(6)
      .tickPadding(10)
      .tickSize(-vis.height);
    vis.yAxis = d3.axisLeft(vis.yScale)
      .tickSize(0)
      .tickPadding(5)
      .tickFormat((d) => statementSourcesMap.find((x) => x.originalName === d).newName);

    // Define size of SVG drawing area
    vis.svg = d3.select(vis.config.parentElement)
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight)
      .attr("style", "outline: thin solid #ddd;");

    // Append group element that will contain our actual chart
    vis.chart = vis.svg.append('g')
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

    vis.chart.append("rect")
      .attr('width', vis.width)
      .attr('height', vis.height)
      .attr("x", 0.5)
      .attr("y", 0.5)
      .style('fill', 'rgba(255, 255, 255, 0.3)');

    // Append empty x-axis group and move it to the bottom of the chart
    vis.xAxisG = vis.chart.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${vis.height})`);

    // Append y-axis group
    vis.yAxisG = vis.chart.append('g')
      .attr('class', 'axis y-axis');

    vis.insertText();
    vis.updateVis();
  }

  /**
     * Prepare the data and scales before we render it.
     */
  updateVis() {
    const vis = this;
    vis.setupStackedData();
    vis.xScale.domain([0, d3.max(vis.list, (d) => d.total)]);
    vis.yScale.domain(statementSourcesMap.map((d) => d.originalName));
    vis.colorScale.domain([0.0, 2.5, 5.0]);
    vis.renderVis();
  }

  /**
     * This function contains the D3 code for binding data to visual elements
     * Important: the chart is not interactive yet and renderVis() is intended
     * to be called only once; otherwise new paths would be added on top
     */
  renderVis() {
    const vis = this;
    const selectedSources = Array.from(document.querySelectorAll('.sourceButton.selected')).map((d) => d.getAttribute('source'));
    const verdicts = vis.chart.selectAll('.verdict')
      .data(vis.stackedData)
      .join('g')
      .attr('class', (d) => `verdict verdict-${d.key}`)
      .attr('fill', (d) => vis.colorScale(d.key));

    const bars = verdicts
      .selectAll('.bar')
      .data((d) => d)
      .join('rect')
      .attr('class', (d) => `bar selector ${d.data.statement_source}`)
      .attr('x', (d) => vis.xScale(d[0]))
      .attr('y', (d) => vis.yScale(d.data.statement_source))
      .attr('height', vis.yScale.bandwidth())
      .attr('width', (d) => {
        if (Number.isNaN(d[1])) {
          return 0;
        }
        return vis.xScale(d[1]) - vis.xScale(d[0]);
      });

    bars
      .on('click', (event, d) => {
        vis.handleSelectionClick(d.data.statement_source);
      })
      .on('mouseover', (event, d) => {
        d3.select('#tooltip')
          .style('display', 'block')
          .style('left', `${event.pageX + vis.config.tooltipPadding}px`)
          .style('top', `${event.pageY + vis.config.tooltipPadding}px`)
          .html(`<div>Statement count: ${d[1] - d[0]}, <br/>
                  Verdict: ${verdictmap.find((x) => x.verdict === d[2]).name}</div>`);
      })
      .on('mouseleave', () => {
        d3.select('#tooltip').style('display', 'none');
      });
    // Update the axes
    vis.xAxisG.call(vis.xAxis);
    vis.yAxisG.call(vis.yAxis);
    const yAxis = document.querySelectorAll('.y-axis')[0];
    const yAxisLabels = yAxis.querySelectorAll('text');
    yAxisLabels.forEach((d) => {
      const statementSourceText = d.innerHTML;
      const { originalName } = statementSourcesMap.find((x) => x.newName === statementSourceText);
      d.setAttribute('class', `selector ${originalName}`);
      d.setAttribute('source', originalName);
    });
    vis.chart.select('.y-axis').selectAll('text')
      .on('click', function (event, d) {
        vis.handleSelectionClick(this.getAttribute('source'));
      });
    selectedSources.forEach((source) => vis.toggleBarDisplay(source));
  }

  handleSelectionClick(statement_source) {
    const vis = this;
    const selectedSources = vis.toggleBarDisplay(statement_source);
    const sourceButtons = Array.from(document.querySelectorAll('.sourceButton'));
    const selectedSourceButton = sourceButtons.filter((x) => x.getAttribute('source') === statement_source)[0];

    vis.dispatcher.call('filterStatementSource', event, selectedSources);

    selectSourceButton(selectedSourceButton);
  }

  toggleBarDisplay(statementSource) {
    const vis = this;
    const selectedSources = Array.from(document.querySelectorAll('.sourceButton.selected')).map((d) => d.getAttribute('source'));

    let isActive;
    document.querySelectorAll(`.selector.${statementSource}`).forEach((e) => {
      isActive = d3.select(e).classed('selected');

      d3.select(e).classed('selected', !isActive);
    });
    if (!isActive) {
      selectedSources.push(statementSource);
    } else {
      const index = selectedSources.indexOf(statementSource);
      selectedSources.splice(index, 1);
    }
    return selectedSources;
  }

  // Insert text elements
  insertText() {
    const vis = this;

    // Append x-axis title
    vis.chart.append('text')
      .attr('class', 'axis-title')
      .text('Statement Count')
      .attr('text-anchor', 'middle')
      .attr('x', vis.width / 2)
      .attr('y', vis.height + 45);

    // Append y-axis title
    vis.chart.append('text')
      .attr('class', 'axis-title')
      .text('Statement Source')
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(-80, ${vis.height / 2}) rotate(-90)`);
  }

  // setups a nested array for creating a stacked bar chart
  setupStackedData() {
    const vis = this;
    const rolledUpArray = d3.rollups(
      vis.data,
      (d) => d.length,
      (d) => d.statement_source,
      (d) => d.verdict,
    );
    const list = [];
    for (let i = 0; i < rolledUpArray.length; i += 1) {
      const row = {};
      let totalStatementCount = 0;
      row.statement_source = rolledUpArray[i][0];
      for (let j = 0; j < rolledUpArray[i][1].length; j += 1) {
        const statementCount = rolledUpArray[i][1][j][1];
        row[rolledUpArray[i][1][j][0]] = statementCount;
        totalStatementCount += statementCount;
      }
      row.total = totalStatementCount;
      list.push(row);
    }

    const stack = d3.stack()
      .keys(['0', '1', '2', '3', '4', '5']);
    const stackedData = stack(list);

    for (let i = 0; i < stackedData.length; i += 1) {
      for (let j = 0; j < stackedData[i].length; j += 1) {
        stackedData[i][j][2] = `${i}`;
      }
    }
    vis.list = list;
    vis.stackedData = stackedData;
  }
}

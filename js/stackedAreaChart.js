class StackedAreaChart {
  /**
   * Class constructor with basic chart configuration
   * @param {Object}
   * @param {Array}
   */
  constructor(_config, _dispatcher, _data) {
    this.config = {
        parentElement: _config.parentElement,
        containerWidth: _config.containerWidth || 900,
        containerHeight: _config.containerHeight || 400,
        margin: {
            top: 25,
            right: 12,
            bottom: 30,
            left: 75
        },
        tooltipPadding: _config.tooltipPadding || 15
    }
    this.dispatcher = _dispatcher;
    this.data = _data;
    this.fullDateRange = null;
    this.initVis();
  }

  /**
   * Initialize chart elements
   */
  initVis() {
    let vis = this;

    vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
    vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

    vis.xScale = d3.scaleTime()
      .range([0, vis.width]);

    vis.yScale = d3.scaleLinear()
      .range([vis.height, 0]);

    vis.colorScale = d3.scaleOrdinal()
      .range(['#a50026', '#f26c40', '#fedd8d', '#d7ee8e', '#64bc61', '#006837']);

    // Initialize axes
    vis.xAxis = d3.axisBottom(vis.xScale)
      .ticks(d3.timeYear.every(2))
      .tickSize(-vis.height - 15)
      .tickPadding(10)
      .tickFormat(d3.timeFormat('%b. %Y'));

    vis.yAxis = d3.axisLeft(vis.yScale)
      .ticks(10)
      .tickSize(-vis.width - 15)
      .tickPadding(10);

    // Define size of SVG drawing area
    vis.svg = d3.select(vis.config.parentElement).append('svg')
      .attr('width', vis.config.containerWidth)
      .attr('height', vis.config.containerHeight + 50)
      .attr('id', "area-chart")
      .attr("style", "outline: thin solid #ddd;");

    // Append group element that will contain our actual chart
    vis.chartArea = vis.svg.append('g')
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top + 10})`);

    // Append empty x-axis group and move it to the bottom of the chart
    vis.xAxisG = vis.chartArea.append('g')
      .attr('class', 'axis x-axis')
      .attr('transform', `translate(0,${vis.height})`);

    // Append y-axis group
    vis.yAxisG = vis.chartArea.append('g')
      .attr('class', 'axis y-axis');

    // Append axis titles
    vis.xAxisTitle = vis.chartArea.append('text')
      .attr('class', 'axis-title')
      .attr('x', vis.width / 2)
      .attr('y', vis.height + vis.config.margin.bottom + 15)
      .attr('text-anchor', 'middle')
      .text('Month of statements');

    vis.yAxisTitle = vis.chartArea.append('text')
      .attr('class', 'axis-title')
      .attr('x', 0)
      .attr('y', vis.height / 2)
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(-220, ${vis.height / 2}) rotate(-90)`)
      .text('Statement count');

    // Append a line for the tooltip
    vis.tooltipLine = vis.chartArea.append('line')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '3,3')  // This makes the line dotted
      .style('opacity', 0);  // Start off hidden

    // Create a brush
    vis.brush = d3.brushX()
      .on("brush", brushed)
      .on("end", brushended);

    // Append group element that will contain the brush
    vis.brushArea = vis.svg.append('g')
      .attr('class', 'brush')
      .attr('width', vis.Width)
      .attr('height', vis.Height)
      .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top + 10})`)
      .style('fill', 'rgba(255, 255, 255, 0.3)')
      .lower();

    // Define the brushed event handler function
    function brushed(event) {}

    // Define the brushended event handler function
    function brushended(event) {
      if (event.selection) {
          // Extract the selected range from the brush event
          var selectedRange = event.selection.map(vis.xScale.invert);

          // Update the domain of your x-scale to match the selected range
          vis.xScale.domain(selectedRange);

          // Redraw your chart to reflect the updated scale
          vis.renderVis();

          // Emit a custom event via the dispatcher to notify other charts of the change
          vis.dispatcher.call("filterbySelectedDateRange", event, selectedRange);

          // Clear the brush selection
          vis.brushArea.call(vis.brush.move, null);
      }
    }

    // Add a 'dblclick' event listener to the chart
    vis.brushArea.on('dblclick', function(event) {
      // Prevent the default behavior of the 'dblclick' event
      event.preventDefault();

      // Reset the domain of your x-scale to its original value (i.e., the full data range)
      vis.xScale.domain(vis.fullDateRange);

      // Clear the brush selection
      vis.brushArea.call(vis.brush.move, null);

      // Redraw your chart to reflect the updated scale
      vis.renderVis();

      // Emit a custom event via the dispatcher to notify other charts of the change
      vis.dispatcher.call("filterbySelectedDateRange", event, vis.fullDateRange);
    });

    // Define stacks
    vis.stack = d3.stack()
      .keys(['verdict0', 'verdict1', 'verdict2', 'verdict3', 'verdict4', 'verdict5']);
  }

  /**
   * Prepare the data and scales before we render it.
   */
  updateVis() {
    let vis = this;
    vis.localData = JSON.parse(JSON.stringify(vis.data));

    // Convert dates to JavaScript Date objects and initialize counts
    vis.localData.forEach(function(d) {
      if (typeof d.statement_date === 'string') {
        d.statement_date = parseTime(d.statement_date);
      }
      // Set day to the first of the month
      d.statement_date.setDate(1);
      d.count = 1;
    });

    // Sort data by date
    vis.localData.sort(function(a, b) {
      return a.statement_date - b.statement_date;
    });

    // Aggregate data
    var aggregatedData = [];
    vis.localData.forEach(function(d) {
      // Find existing entry for this month and verdict
      var entry = aggregatedData.find(function(e) {
        return e.statement_date.getTime() === d.statement_date.getTime() && e.verdict === d.verdict;
      });

      if (entry) {
        // If entry exists, increment count
        entry.count += 1;
      } else {
        // If entry doesn't exist, add new entry
        aggregatedData.push({statement_date: d.statement_date, verdict: d.verdict, count: 1});
      }
    });

    // Fill in missing months and ensure all verdicts exist
    var transformedData = [];
    var dateExtent = d3.extent(aggregatedData, function(d) { return d.statement_date; });
    var currentDate = new Date(dateExtent[0]);
    while (currentDate <= dateExtent[1]) {
      var entry = {statement_date: new Date(currentDate)};
      for (var i = 0; i < 6; i++) {
        var verdictEntry = aggregatedData.find(function(e) {
          return e.statement_date.getTime() === currentDate.getTime() && e.verdict === i.toString();
        });
        entry['verdict' + i] = verdictEntry ? verdictEntry.count : 0;
      }
      transformedData.push(entry);
      currentDate.setMonth(currentDate.getMonth() + 1); // increment month
    }

    if (vis.fullDateRange === null) {
      vis.fullDateRange = d3.extent(transformedData, function(d) { return d.statement_date; })
    }

    vis.stackedData = vis.stack(transformedData)

    // Set the x-scale domain to the extent of the dates
    vis.xScale.domain(d3.extent(transformedData, function(d) { return d.statement_date; }));

    // Set the y-scale domain from 0 to the maximum count
    vis.yScale.domain([0, d3.max(transformedData, function(d) { 
      return d3.sum(['verdict0', 'verdict1', 'verdict2', 'verdict3', 'verdict4', 'verdict5'], function(key) {
        return d[key];
      });
    })]);

    // Update the brush extent to match the dimensions of chart
    vis.brush.extent([[0, 0], [vis.width, vis.height]]);

    vis.area = d3.area()
      .x(function(d) { return vis.xScale(d.data.statement_date); })
      .y0(function(d) { return vis.yScale(d[0]); })
      .y1(function(d) { return vis.yScale(d[1]); });
    
    vis.renderVis();
  }

  renderVis() {
    let vis = this;

    // Add line path
    vis.chartArea.selectAll('.area-path')
      .data(vis.stackedData)
      .join('path').transition()
      .attr('class', 'area-path')
      .attr('d', vis.area)
      .attr('fill', d => vis.colorScale(d.key));

    
    // Tooltip event listeners
    var bisectDate = d3.bisector(function(d) { return d.data.statement_date; }).left;
    var verdicts = ["Pants-fire", "False", "Mostly false", "Half true", "Mostly true", "True"];

    vis.chartArea.selectAll('path')
      .on('mouseover', function (event, d) {
        d3.select('#tooltip')
          .style('display', 'block')
          .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
          .style('top', (event.pageY + vis.config.tooltipPadding) + 'px');
      })
      .on("mousemove", function(event, d) {
        // Get mouse position
        var mouseX = d3.pointer(event)[0];
        // Use the bisector to find the closest data point to the mouse position
        var currentDate = vis.xScale.invert(mouseX);
        var closestIndex = bisectDate(vis.stackedData[d.index], currentDate);
        // Get the data for this point
        var currentData = vis.stackedData[d.index][closestIndex-1];
        var currentYear = new Date(currentData.data.statement_date).getFullYear();
        var currentMonth = (new Date(currentData.data.statement_date)).toLocaleString('default', { month: 'short' });
        var verdictString = verdicts[d.index];
        // Show tooltip
        d3.select('#tooltip')
          .style('display', 'block')
          .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
          .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
          .html(`
              <ul>
                <li>Time: ${currentMonth}. ${currentYear} </li>
                <li>Verdict: ${verdictString} </li>
                <li>Statement count: ${currentData[1]-currentData[0]} </li>
              </ul>
            `);
        
        // Show the tooltip line and position it at the mouse's x position
        vis.tooltipLine
          .style('opacity', 1)
          .attr('x1', mouseX)
          .attr('x2', mouseX)
          .attr('y1', 0)
          .attr('y2', vis.height);
      })
      .on('mouseout', function(d) {
          // Hide tooltip
          d3.select('#tooltip').style('display', 'none');

          // Hide the tooltip line
          vis.tooltipLine.style('opacity', 0);
      });

    // Update the ticks
    var domainRange = vis.xScale.domain()[1] - vis.xScale.domain()[0];
    if (domainRange <= 365 * 24 * 60 * 60 * 1000) {  // If the domain range is less than or equal to 1 Year
      vis.xAxis.ticks(d3.timeMonth.every(1));
    } else if (domainRange <= 3 * 365 * 24 * 60 * 60 * 1000) {  // If the domain range is less than or equal to 3 Year
      vis.xAxis.ticks(d3.timeMonth.every(4));
    } else if (domainRange <= 5 * 365 * 24 * 60 * 60 * 1000) {  // If the domain range is less than or equal to 5 Year
      vis.xAxis.ticks(d3.timeMonth.every(6));
    } else {
      vis.xAxis.ticks(d3.timeYear.every(2));  // Show one tick per 2 year
    }

    // Update the axes
    vis.xAxisG.call(vis.xAxis);
    vis.yAxisG.call(vis.yAxis);

    // Call the brush function on the brushArea
    vis.brushArea.call(vis.brush);
  }
  
}
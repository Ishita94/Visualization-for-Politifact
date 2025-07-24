class ScatterPlot {

    /**
     * Class constructor with basic chart configuration
     * @param {Object}
     */
    constructor(_config, _dispatcher, _data) {
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: 900,
            containerHeight: 400,
            margin: {
                top: 50,
                right: 25,
                bottom: 30,
                left: 50
            },
            tooltipPadding: _config.tooltipPadding || 15
        }
        this.dispatcher = _dispatcher;
        this.data = _data;

        this.initVis();
    }

    initVis() {
        let vis = this;

        // Calculate inner chart size. Margin specifies the space around the actual chart.
        vis.width = vis.config.containerWidth - vis.config.margin.left - vis.config.margin.right;
        vis.height = vis.config.containerHeight - vis.config.margin.top - vis.config.margin.bottom;

        vis.xScale = d3.scaleLinear()
            .range([0, vis.width]);

        vis.yScale = d3.scaleLinear()
            .range([vis.height, 0]);

        vis.radiusScale = d3.scaleSqrt() // for circles
            .range([2, 50]); //testing

        vis.colorScale = d3
            .scaleDiverging(d3.interpolateRdYlGn) //interpolator for diverging color scheme from red (pants-fire) to
            // green (true)
            .clamp(true);

        // Initialize axes
        vis.xAxis = d3.axisBottom(vis.xScale)
            .ticks(12)
            .tickSize(-vis.height - 10)
            .tickPadding(15);

        vis.yAxis = d3.axisLeft(vis.yScale)
            .ticks(10)
            .tickSize(-vis.width - 10)
            .tickPadding(10);

        // Define size of SVG drawing area
        vis.svg = d3.select(vis.config.parentElement).append('svg')
            .attr('width', vis.config.containerWidth)
            .attr('height', vis.config.containerHeight)
            .attr('id', "scatter-plot")
            .attr("style", "outline: thin solid #ddd;");


        // Append group element that will contain our actual chart
        // and position it according to the given margin config
        vis.chartArea = vis.svg.append('g')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Append both axis titles
        vis.chartArea.append('text')
            .attr('class', 'axis-title')
            .attr('y', vis.height)
            .attr('x', vis.width + 10)
            .attr('dy', '.71em')
            .style('text-anchor', 'end')
            .text('Accuracy Score');

        vis.chartArea.append('text')
            .attr('class', 'axis-title')
            .attr('x', -30)
            .attr('y', -30)
            .attr('dy', '.71em')
            .text('Statement Count');

        // Initialize clipping mask that covers the whole chart
        vis.chartArea.append('defs')
            .append('clipPath')
            .attr('id', 'chart-mask')
            .append('rect')
            .attr('width', vis.width)
            .attr('y', -10)
            .attr('height', vis.config.containerHeight-70);

        var axes = vis.svg.append("g")
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        vis.xAxisG = axes.append('g')
            .attr('class', 'axis x-axis')
            .attr('transform', `translate(0,${vis.height})`);

        // Append y-axis group
        vis.yAxisG = axes.append('g')
            .attr('class', 'axis y-axis');

        var focus = vis.svg.append("g")
            .attr("class", "focus")
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`);

        // Apply clipping mask to 'vis.chart' to clip circles
        vis.chart = focus.append('g') //vis.chart is equal to points in example
            .attr('clip-path', 'url(#chart-mask)');

        // Set the zoom and Pan features: how much we can zoom, on which part, and what to do when there is a zoom

        const gx = vis.xAxisG
            .call(vis.xAxis);

        const gy = vis.yAxisG
            .call(vis.yAxis);

        var zoom = d3.zoom()
            .scaleExtent([1, 10])  // This control how much you can unzoom (x1) and zoom (x20)
            .extent([[0, 0], [vis.width, vis.height]])
            .filter(filter)
            .on("zoom", zoomed);

        const view = focus.append("rect")
            .attr("width", vis.width + 10)
            .attr("height", vis.height + 10)
            .attr("x", 0.5)
            .attr("y", 0.5)
            .attr('transform', `translate(0,-10)`)
            .style('fill', 'rgba(255, 255, 255, 0.3)')
            .style("pointer-events", "all")
            .lower();

        focus.call(zoom);

        // prevent scrolling then apply the default filter
        function filter(event) {
            event.preventDefault();
            return (!event.ctrlKey || event.type === 'wheel') && !event.button;
        }
        function zoomed({ transform }) {
            // view.attr("transform", transform);
            var newX = transform.rescaleX(vis.xScale);
            var newY = transform.rescaleY(vis.yScale);

            // update circle position
            vis.chart.selectAll('.point')
                .attr('cx', function(d) {return newX(vis.xValue(d))})
                .attr('cy', function(d) {return newY(vis.yValue(d))});

            gx.call(vis.xAxis.scale(transform.rescaleX(vis.xScale)));
            gy.call(vis.yAxis.scale(transform.rescaleY(vis.yScale)));

        }

    }

    updateVis() {
        let vis = this;

        //Colors for each of the 6 available verdicts
        vis.pantsFireVerdictColor = vis.colorScale(0.0);
        vis.falseVerdictColor = vis.colorScale(1.0);
        vis.mostlyFalseVerdictColor = vis.colorScale(2.0);
        vis.halfTrueVerdictColor = vis.colorScale(3.0);
        vis.mostlyTrueVerdictColor = vis.colorScale(4.0);
        vis.trueVerdictColor = vis.colorScale(5.0);

        const groupedOriginators = d3.groups(vis.data, d => d.statement_originator)

        vis.originatorList = groupedOriginators.map(function(d){
            const totalNumberofStatements = d[1].length;
            const verdicts = d[1].map(d=>parseInt(d.verdict));
            const sumofVerdicts = verdicts.reduce((a,c) => a + c, 0);
            const avgVerdict = sumofVerdicts / totalNumberofStatements;

            return({statement_originator: d[0], statements: d[1], statement_count: totalNumberofStatements,
                avg_verdict: avgVerdict});
        })
        vis.originatorList.sort((a, b) => a.statement_originator - b.statement_originator);

        d3.selectAll(".textforOriginatorSummary").text(", number of selected originators is " + vis.originatorList.length);
        const originators = vis.originatorList.map((d) => d.statement_originator);
        autocomplete(document.getElementById('myInput'), originators);

        // Specify accessor functions
        vis.xValue = d => d.avg_verdict;
        vis.yValue = d => d.statement_count;

        // Set the scale input domains
        vis.xScale.domain([0.0, 5.0]);
        vis.yScale.domain([d3.min(vis.originatorList, vis.yValue), d3.max(vis.originatorList, vis.yValue)]);
        vis.radiusScale.domain([d3.min(vis.originatorList, vis.yValue), d3.max(vis.originatorList, vis.yValue)]);
        vis.colorScale.domain([0.0, 2.5, 5.0]);   //according to range of values in accuracy score

        vis.renderVis();
    }

    renderVis() {
        let vis = this;

        // Add circles
        const circles = vis.chart.selectAll('.point')
            .data(vis.originatorList)
            .join('circle')
            .attr('r', d=> vis.radiusScale(vis.yValue(d)))
            .attr('cy', d => vis.yScale(vis.yValue(d)))
            .attr('cx', d => vis.xScale(vis.xValue(d)))
            .attr('fill', function(d){
                var color= vis.colorScale(vis.xValue(d));
                return color;
            })
            .attr('class', 'point')
            .attr('id', d=>d.statement_originator)
            .attr('class', function(d) {
                    if (selectedPointListGlobal.includes(d.statement_originator)) //check if point is already selected or not
                    {
                        return "point selected"; //point is selected
                    }
                    else
                    {
                        return "point";
                    }
                }
            );

        // Tooltip event listeners
        circles
            .on('mouseover', function (event, d)  {
                d3.select('#tooltip')
                    .style('display', 'block')
                    .style('left', (event.pageX + vis.config.tooltipPadding) + 'px')
                    .style('top', (event.pageY + vis.config.tooltipPadding) + 'px')
                    .html(`
              <div class="tooltip-title">${d.statement_originator}</div>
              <ul>
                <li>Statement count: ${d.statement_count} </li>
                <li>Accuracy score: ${Number(d.avg_verdict).toFixed(2)} </li>
              </ul>
            `);
            })
            .on('mouseleave', () => {
                d3.select('#tooltip').style('display', 'none');
            })
            .on('click', function (event, d) {
                // Check if current point is selected and toggle selection
                var isSelected = d3.select(this).classed('selected');

                d3.select(this).classed('selected', !isSelected);

                //update global list of selected points
                const selectedPoints = vis.chart.selectAll('.point.selected').data();
                if(selectedPoints.length>0){
                    d3.selectAll(".textforOriginatorSummary").text(", number of filtered originators is " + selectedPoints.length);
                }
                else
                {
                    d3.selectAll(".textforOriginatorSummary").text(", number of filtered originators is " + vis.originatorList.length);
                }
                //Trigger filter event and pass array with the selected gender name
                vis.dispatcher.call('filterbySelectedPoints', event, selectedPoints);

            });


        // Update the axes/gridlines
        vis.xAxisG
            .call(vis.xAxis);

        vis.yAxisG
            .call(vis.yAxis);
    }


}

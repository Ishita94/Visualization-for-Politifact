# Visualization of political statements fact-checked by Politifact

- Followed code in this link to zoom in the scatter plot: https://d3-graph-gallery.com/graph/interactivity_zoom.html
- We included moment.js from cdnjs for date manipulation
- Followed code from this link to implement originator searchbox: 
https://www.w3schools.com/howto/howto_js_autocomplete.asp
- Followed code from this link to implement zoom in scatterplot (work-in-progress):
  https://d3-graph-gallery.com/graph/interactivity_zoom.html
- Followed code from d3-examples
- As interactions are incomplete in M3 version, we created 'politifact_originator.csv' and 'politifact_monthly.csv' 
by Python and used them to display the scatterplot and stacked area chart. In M4, we will use only
politifact_filtered.csv.
- Zoom in scatterplot does not work properly. Currently it zooms  and pans the entire chart, and the axes are not 
updated. We will fix this issue in M4.
- https://www.jqueryscript.net/time-clock/jquery-ui-month-picker.html
- Showing tooltip while zooming: https://stackoverflow.com/questions/58125180/d3-zoom-and-mouseover-tooltip
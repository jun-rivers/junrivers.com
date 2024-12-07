
//var myCsv = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVL1_ah4UARJw_tKyQ5TiT-kx_arrgpTQiMpZHoar7WKpCY-HDeVJHqN0aRuUYsEtzsJOIj8vHfV65/pub?output=csv";
var myCsv = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQqySoKDQNoFqxTKAh43KPaAP_IpuYkA2zUzA3xCiWpXl3EWi2HnJaMMXZF3xsLeW7OuV05hoSRix9r/pub?output=csv";

const width = window.innerWidth,
    height = window.innerHeight,
    maxRadius = (Math.min(width, height) / 2) - 5;

const formatNumber = d3.format('');

const x = d3.scaleLinear()
    .range([0, 2 * Math.PI])
    .clamp(true);

const y = d3.scaleSqrt()
    .range([maxRadius*.1, maxRadius]);

// const color = d3.scaleOrdinal(d3.schemeCategory20c);
const colors = {
    "idea": "#9E9EFE",
    "developing": "#F2ACA4",
    "operating": "#323232",
    "mature": "#66AA66",
};

const partition = d3.partition();

const arc = d3.arc()
    .startAngle(d => x(d.x0))
    .endAngle(d => x(d.x1))
    .innerRadius(d => Math.max(0, y(d.y0)))
    .outerRadius(d => Math.max(0, y(d.y1)));

const middleArcLine = d => {
    const halfPi = Math.PI/2;
    const angles = [x(d.x0) - halfPi, x(d.x1) - halfPi];
    const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);

    const middleAngle = (angles[1] + angles[0]) / 2;
    const invertDirection = middleAngle > 0 && middleAngle < Math.PI; // On lower quadrants write text ccw
    if (invertDirection) { angles.reverse(); }

    const path = d3.path();
    path.arc(0, 0, r, angles[0], angles[1], invertDirection);
    return path.toString();
};

const textFits = d => {
    const CHAR_SPACE = 6;

    const deltaAngle = x(d.x1) - x(d.x0);
    const r = Math.max(0, (y(d.y0) + y(d.y1)) / 2);
    const perimeter = r * deltaAngle;

    return d.data.name.length * CHAR_SPACE < perimeter;
};

const svg = d3.select('body').append('svg')
    .style('width', '100vw')
    .style('height', '100vh')
    .attr("id", "pie")
    .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`)
    .on('click', () => focusOn()); // Reset zoom on canvas click

d3.csv(myCsv, function(data){
    var tree = DataStructures.Tree.createFromFlatTable(data),
    root = tree.toSimpleObject(function(objectToDecorate, originalNode) {
      objectToDecorate.size = originalNode.size;
      if (objectToDecorate.children && objectToDecorate.children.length == 0) {
          delete objectToDecorate.children;
      }
      return objectToDecorate;
    });

    root = d3.hierarchy(root);
    root.sum(d => d.size);

    const slice = svg.selectAll('g.slice')
        .data(partition(root).descendants());

    slice.exit().remove();

    // Now redefine the value function to use the previously-computed sum.
    const newSlice = slice.enter()
        .append('g').attr('class', 'slice')
        .on('click', d => {
            d3.event.stopPropagation();
            focusOn(d);
        });

    newSlice.append('title')
        .text(d => d.data.id + ' / ' + d.data.weight + '%');



    newSlice.append('path')
        .attr('class', 'main-arc')
        .style('fill', function(d) { 
          return colors[d.data.status];
        })
        .style('opacity', function(d) { 
          var w = d.data.workcode;
          if (!w) {return 1;}
          return 1-((w.match(/-/g) || []).length)/9 })
        .attr('d', arc)
        .on("mouseover", mouseover);

    newSlice.append('path')
        .attr('class', 'hidden-arc')
        .attr('id', (_, i) => `hiddenArc${i}`)
        .attr('d', middleArcLine);

    const text = newSlice.append('text')
        .attr('display', d => textFits(d) ? null : 'none')
        .style('fill', '#fff');

    // Add white contour
    text.append('textPath')
        .attr('startOffset','50%')
        .attr('xlink:href', (_, i) => `#hiddenArc${i}` )
        .text(d => d.data.name)
        .style('fill', 'none')
        .style('stroke', '#666')
        .style('stroke-width', 2)
        .style('stroke-linejoin', 'round');

    text.append('textPath')
        .attr('startOffset','50%')
        .attr('xlink:href', (_, i) => `#hiddenArc${i}` )
        .text(d => d.data.name);

    // Add the mouseleave handler to the bounding circle.
    d3.select('#pie').on('mouseleave', mouseleave);
});

function focusOn(d = { x0: 0, x1: 1, y0: 0, y1: 1 }) {
    // Reset to top-level if no data point specified

    const transition = svg.transition()
        .duration(750)
        .tween('scale', () => {
            const xd = d3.interpolate(x.domain(), [d.x0, d.x1]),
                yd = d3.interpolate(y.domain(), [d.y0, 1]);
            return t => { x.domain(xd(t)); y.domain(yd(t)); };
        });

    transition.selectAll('path.main-arc')
        .attrTween('d', d => () => arc(d));

    transition.selectAll('path.hidden-arc')
        .attrTween('d', d => () => middleArcLine(d));

    transition.selectAll('text')
        .attrTween('display', d => () => textFits(d) ? null : 'none');

    moveStackToFront(d);

    //

    function moveStackToFront(elD) {
        svg.selectAll('.slice').filter(d => d === elD)
            .each(function(d) {
                this.parentNode.appendChild(this);
                if (d.parent) { moveStackToFront(d.parent); }
            })
    }
}

// Fade all but the current sequence, and show it in the breadcrumb trail.
function mouseover(d) {
  
  console.log(d);

  var title = d.data.name;
  var branchdetail = 'ID: ' + d.data.workcode + '<br/>'
          + '<br/> percentage of ' + d.data.parentcode + ': <h3>' + d.data.percentage + '%</h3>'
          + '<br/> status: <h3>' + d.data['status'] + '</h3>'
          + '<br/> one-liner: <h3>' + d.data['one-liner'] + '</h3>'
          + '<br/> why: <h4>' + d.data['why-purpose'] + '</h4>'
          + '<br/> how: <h4>' + d.data['how-strategy'] + '</h4>'
          + '<br/> what: <h4>' + d.data['what-usp'] + '</h4>';
  var rootdetail = 
          'one-liner: <h3>' + d.data['one-liner'] + '</h3>'
          + '<br/> why: <h4>' + d.data['why-purpose'] + '</h4>'
          + '<br/> how: <h4>' + d.data['how-strategy'] + '</h4>'
          + '<br/> what: <h4>' + d.data['what-usp'] + '</h4>';

  d3.select('#title')
      .text(title);

  if (d.data.workcode) {
    d3.select('#detail')
        .html(branchdetail);
  } else {
    d3.select('#detail')
        .html(rootdetail);
  }

  d3.select('#info')
      .style('visibility', '');

  // Fade all the segments.
  d3.selectAll('path')
      .style('opacity', 0.3);

  // Then highlight only those that are an ancestor of the current segment.
  d3.select(this)
      .style('opacity', 1);
}

// Restore everything to full opacity when          `ving off the visualization.
function mouseleave(d) {

  d3.select('#info')
      .style('visibility', 'hidden');
  // Deactivate all segments during transition.
  d3.selectAll('path').on('mouseover', null);

  // Transition each segment to full opacity and then reactivate it.
  d3.selectAll('path')
      .transition()
      .duration(1000)
      .style('opacity', function(d) { 
          var w = d.data.workcode;
          if (!w) {return 1;}
          return 1-((w.match(/-/g) || []).length)/9 })
      .on('end', function() {
              d3.select(this).on('mouseover', mouseover);
            });
}
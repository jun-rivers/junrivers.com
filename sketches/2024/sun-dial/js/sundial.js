
//var myCsv = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVL1_ah4UARJw_tKyQ5TiT-kx_arrgpTQiMpZHoar7WKpCY-HDeVJHqN0aRuUYsEtzsJOIj8vHfV65/pub?output=csv";
var myCsv = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQVL1_ah4UARJw_tKyQ5TiT-kx_arrgpTQiMpZHoar7WKpCY-HDeVJHqN0aRuUYsEtzsJOIj8vHfV65/pub?output=csv";

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
    "EXP.OS": "#323232",
    "RESOURCES": "#595959",
    "RM": "#F2ECE4",
    "BX.": "#EFD7D0",
    "EXP.J": "#828282",
    "EXP.L": "#005e95"
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

// var margin = {top: 350, right: 480, bottom: 350, left: 480},
//     radius = Math.min(margin.top, margin.right, margin.bottom, margin.left) - 10;

// var hue = d3.schemeCategory20;

// var luminance = d3.scaleSqrt()
//     .domain([0, 2**9])
//     .clamp(true)
//     .range([90, 20]);

// var svg = d3.select("body").append("svg")
//     .attr("width", margin.left + margin.right)
//     .attr("height", margin.top + margin.bottom)
//   .append("g")
//     .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// var partition = d3.partition()
//     .sort(function(a, b) { return d3.ascending(a.name, b.name); })
//     .size([2 * Math.PI, radius]);

// var arc = d3.arc()
//     .startAngle(function(d) { return d.x; })
//     .endAngle(function(d) { return d.x + d.dx ; })
//     .padAngle(.01)
//     .padRadius(radius / 3)
//     .innerRadius(function(d) { return radius / 3 * d.depth; })
//     .outerRadius(function(d) { return radius / 3 * (d.depth + 1) - 1; });

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

    // // Compute the initial layout on the entire tree to sum sizes.
    // // Also compute the full name and fill color for each node,
    // // and stash the children so they can be restored as we descend.
    // partition
    //     .value(function(d) { return d.size; })
    //     .nodes(root)
    //     .forEach(function(d) {
    //       d._children = d.children;
    //       d.sum = d.value;
    //       d.key = key(d);
    //       d.fill = fill(d);
    //     });

    // Now redefine the value function to use the previously-computed sum.
    const newSlice = slice.enter()
        .append('g').attr('class', 'slice')
        .on('click', d => {
            d3.event.stopPropagation();
            focusOn(d);
        });

    newSlice.append('title')
        .text(d => d.data.name + ' / ' + d.data.percentage + '%');



    newSlice.append('path')
        .attr('class', 'main-arc')
        // .style('fill', d => color((d.children ? d : d.parent).data.name))
        .style('fill', function(d) { 
          var w = d.data.workcode;
          var end;
          if (!w) {return colors['OS'];}
          if (w.indexOf("-") > 0) {
            end = w.indexOf("-");
          } else {
            end = w.length;
          }
          return colors[w.substr(0, end)]
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
  var detail = d.data.workcode + '<br/>'
          + '<br/> percentage of ' + d.data.parentcode + ': <h3>' + d.data.percentage + '%</h3>'
          + '<br/> annual budget (K HKD): <h3>' + d.data['annual-budget'] + '</h3>'
          + '<br/> monthly budget (K HKD): <h3>' + d.data['monthly-budget'] + '</h3><br/>'
          + '<br/> ' + d.data.notes; 

  d3.select('#title')
      .text(title);

  if (d.data.workcode) {
    d3.select('#detail')
        .html(detail);
  } else {
    d3.select('#detail')
        .html('');
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

// Restore everything to full opacity when moving off the visualization.
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
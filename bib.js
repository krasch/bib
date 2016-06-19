'use strict';


PDFJS.getDocument("networks.pdf")
     .then(pdf => pdf.getPage(2))
     .then(renderPage)
     .then(showCitationAnnotations);
     //.then(extractText)
     //.then(text => console.log(text));

function renderPage(page) {
    var scale = 3;
    var viewport = page.getViewport(scale);

    // prepare canvas using PDF page dimensions.
    var canvas = document.getElementById('pdf-canvas');
    var context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // prepare rendering context
    var renderContext = {
        canvasContext: context,
        viewport: viewport
    };

    //set up annotations layer
     var svg = d3.select("#annotation-div")
                .append("svg")
                .attr("width", viewport.width)
                .attr("height", viewport.height)
                .attr("viewBox", "0 -" + viewport.height + " " + viewport.width +" " + viewport.height)
                .append("g") 
                .attr("transform", "scale(" +scale+")");   
   
    //perform the actual rendering
    return page.render(renderContext).then(() => page.getTextContent());
}

function findCitations(text) {
    var canvas = document.getElementById('pdf-canvas');
    var context = canvas.getContext('2d');
    context.font = (9.9626 + 0.1) + "px Times New Roman";
    //context.fillStyle = "red";
    //context.fillText("works, particularly when combined with Adagrad [10]", 108*scale, viewport.height - 573.6500000000005*scale);

    function textWidth(text) {
        return context.measureText(text).width;
    }

    function calculateCoordinates(text, startIndex, stopIndex, transform) {
        return {"left": transform[4] + textWidth(text.slice(0, startIndex)),
                 "width": textWidth(text.slice(startIndex, stopIndex)),
                 "top": transform[5] + transform[0],
                 "height": transform[0]}
    }

    function find(items) {
        var found = [];
        for (var i=0; i<items.length; i++) {
            var line = items[i].str;
            
            // first try to find any citations in [] brackets, e.g [17], [17, 18, 22]
            var inBrackets = matchAll(line, /\[([0-9, ]+?)\]/g);

            // each bracket might contain several citations, find the individual ones
            for (var b=0; b<inBrackets.length; b++) {
                var citations = matchAll(inBrackets[b]["group"], /([0-9]+)/g);

                // finally, calculate the canvas cordinates for each citation
                for (var c=0; c < citations.length; c++) {
                    var startIndex = inBrackets[b]["index"] + citations[c]["index"] + 1; 
                    var stopIndex = startIndex + citations[c]["group"].length;
                    var coordinates = calculateCoordinates(line, startIndex, stopIndex, items[i].transform);
                    
                    // and append to list of found citations
                    var id = i*100+b*10+c;  // unique identifier for each citation found 
                    found.push({"id": id, "coordinates": coordinates}) 
                }
            }
        }
        return found;
    }

    function matchAll(string, regex) {
        // in JS, string.replace = regex matchall; the following is a bit icky but best way to solve it    
        var matches = []
        string.replace(regex, (match, group, index, all) => matches.push({"match":match, "group": group, "index":index, "all": all}))
        return matches;
    }

 
    return find(text.items);
}


function showCitationAnnotations(text) {
    var citations = findCitations(text);
    console.log(citations);

    var svg = d3.select("#annotation-div").select("g");

    // for each citation make a group of svg elements
    var groups = svg.selectAll("g")
                    .data(citations)
                    .enter()
                    .append("g")
                    //and center that group at the location of the citation, makes all later indexing much easier
                    .attr("transform", d => "translate("+d.coordinates.left+", -" + d.coordinates.top+")");

    // clickable marker of the citation
    groups.append("rect")
          .attr("x", 0)
          .attr("y", 2)
          .attr("width", d => d.coordinates.width )
          .attr("height", d => d.coordinates.height)
          .classed("citation-marker", true)  
          .on("mouseover", d => d3.select("#tooltip" + d.id).classed("hidden", false))
          .on("mouseout", d => d3.select("#tooltip" + d.id).classed("hidden", true));

    
    // another subgroup for each citation contains everything needed for the tool tips, super useful for quickly hiding everything
    var tooltipGroups = groups.append("g")
                              .classed("hidden", true)
                              .attr("id", d => "tooltip"+ d.id); 

    // box for putting the info about the citation
    tooltipGroups.append("rect")
                 .attr("x", d => d.coordinates.width + 3)
                 .attr("y", 0)
                 .attr("width", 100)
                 .attr("height", 30)
                 .classed("citation-tooltip-box", true);

    // the citation info
    tooltipGroups.append("text")
                 .attr("x", d => d.coordinates.width + 10)
                 .attr("y", 20)
                 .text("Reference text here")
                 .classed("citation-tooltip-text", true);
}

function extractText(page) {
    console.log(page);
    var lineStart = 108;
    var regularDistance = 11;

    var ys = page.items.map(it => it.transform[5]);
    var lineDistances = substract([0].concat(ys), ys);
    var paragraphBreaks = lineDistances.map((d, i) => {if (d>regularDistance) return i}).filter(Boolean);

    var text = page.items.map(t=>t.str);
    var paragraphs = text.multislice(paragraphBreaks).map(par => par.join(" "));
    
    return paragraphs;
}

//todo replace with math.js
  function substract(array1, array2) {
      var diff = [];
      for (var i = 0; i < array1.length; i++) {
        diff.push(array1[i] - array2[i]);
      }
      return diff;
  }

  Array.prototype.multislice = function() {
    var idx = Array.apply(null, arguments)[0];
    var slices = []
 
    for (var i=0; i<idx.length; i++) {
        if (i==0)
           slices.push(this.slice(0, idx[i]));
        else  
           slices.push(this.slice(idx[i-1], idx[i]));
    }
    return slices;
  }

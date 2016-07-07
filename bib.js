'use strict';

var pdf = "entrylevel.pdf"
var scale = 1.5;
var currentPage = 3;


PDFJS.getDocument(pdf)
     .then(pdf => pdf.getPage(currentPage))
     .then(renderPage);

var bibliography;

PDFJS.getDocument(pdf)
     .then(findBibliography)
     .then(bib => bibliography=bib);


function renderPage(page) {
    var renderContext = initCanvas(page);
   
    return page.render(renderContext)
                .then(() => page.getTextContent())
                .then(showAnnotations)
}

function previousPage() {
    if (currentPage==1)
        return;
    currentPage--;
    PDFJS.getDocument(pdf)
         .then(pdf => pdf.getPage(currentPage))
         .then(renderPage);
}

function nextPage() {
    currentPage++;
    PDFJS.getDocument(pdf)
         .then(pdf => pdf.getPage(currentPage))
         .then(renderPage);    
}


function initCanvas(page) {
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

    return renderContext;
}


function showAnnotations(page) {
    var text = restoreLines(page);
    var references = findReferences(text);

    var svg = d3.select("#annotation-div").select("g");

    // for each reference make a group of svg elements
    var groups = svg.selectAll("g").data(references, d=> d.id)

    // remove old references (from a previous page)
    groups.exit().remove()

    // center that group at the location of the reference, makes all later indexing much easier                  
    groups.enter()
          .append("g")
          .attr("transform", d=> "translate("+d.coordinates.left+", -" + d.coordinates.top+")");



    // clickable marker of the reference
    groups.append("rect")
          .attr("x", 0)
          .attr("y", 2)
          .attr("width", d => d.coordinates.width )
          .attr("height", d => d.coordinates.height)
          .classed("reference-marker", true)  
          .on("mouseover", d => d3.select("#tooltip" + d.id).classed("hidden", false))
          .on("mouseout", d => d3.select("#tooltip" + d.id).classed("hidden", true))
          .on("click", d=> addToFile(bibliography[d.ref]));

    
    // another subgroup for each reference contains everything needed for the tool tips, super useful for quickly hiding everything
    var tooltipGroups = groups.append("g")
                              .classed("hidden", true)
                              .attr("id", d => "tooltip"+ d.id); 

    // box for putting the info about the reference
    tooltipGroups.append("rect")
                 .attr("x", d => d.coordinates.width + 3)
                 .attr("y", 0)
                 .attr("width", 450)
                 .attr("height", 30)
                 .classed("reference-tooltip-box", true);

    //tooltipGroups.append("foreignObject").attr("width", "100%").attr("height", "100%").append("div").classed("reference-tooltip-text", true).append("span").text("hallo")

    // the reference info
    tooltipGroups.append("text")
                 .attr("x", d => d.coordinates.width + 10)
                 .attr("y", 20)
                 .text(d => bibliography[d.ref])
                 .attr("font-size", 10)
                 .classed("reference-tooltip-text", true);
}

// where to render box marking a reference
function getCoordinates(line, startIndex, stopIndex, transform) {
    var canvas = document.getElementById('pdf-canvas');
    var context = canvas.getContext('2d');
    var fontsize = (9.9626 + 0.);

    function textWidth(text) {
        context.font = fontsize+ "px Times New Roman";
        return context.measureText(text).width;
    }

    return {"left": transform[4] + textWidth(line.slice(0, startIndex)),
             "width": textWidth(line.slice(startIndex, stopIndex)),
             "top": transform[5] + transform[0],
             "height": transform[0]}
}

function addToFile(data) {
    d3.xhr("http://localhost:8080/").send("POST", data);
}




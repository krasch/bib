function extractText(page) {
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


function restoreLines(text) {
    var lines = [];
    var currentLine = null;    
    for (var i=0; i<text.items.length; i++) {
        // init
        if (!currentLine) {
            currentLine = text.items[i];
            continue;
        }
        
        // items[i] appears on same line
        if (Math.abs(currentLine.transform[5] - text.items[i].transform[5]) < 0.001) {
            currentLine.str += text.items[i].str
            currentLine.width += text.items[i].width
        }
        // items[i] appears on new line 
        else {
            lines.push(currentLine);
            currentLine = text.items[i];    
        }
    }
    text.items = lines;

    return text;
}

function matchAll(string, regex) {
    // in JS, string.replace = regex matchall; the following is a bit icky but best way to solve it    
    var matches = []
    string.replace(regex, (match, group, index, all) => matches.push({"match":match, "group": group, "index":index, "all": all}))
    return matches;
}


function findReferences(page) {

    var found = [];
    for (var i=0; i<page.items.length; i++) {
        var line = page.items[i].str;
        
        // first try to find any references in [] brackets, e.g [17], [17, 18, 22]
        var inBrackets = matchAll(line, /\[([0-9, ]+?)\]/g);

        // each bracket might contain several references, find the individual ones
        for (var b=0; b<inBrackets.length; b++) {
            var references = matchAll(inBrackets[b]["group"], /([0-9]+)/g);

            // finally, calculate the canvas cordinates for each reference
            for (var c=0; c < references.length; c++) {
                var startIndex = inBrackets[b]["index"] + references[c]["index"] + 1; 
                var stopIndex = startIndex + references[c]["group"].length;
                var coordinates = getCoordinates(line, startIndex, stopIndex, page.items[i].transform);
                
                // and append to list of found references
                var id = i*100+b*10+c;  // unique identifier for each reference found (same article can be reference several times on the same page)
                found.push({"id": id, "coordinates": coordinates, "ref": references[c]["group"]}) 
            }
        }
    }
    return found;
}


function findBibliography(pdf) {
    // lot's of duplicate code, very ew
    function getText(page) {
        var viewport = page.getViewport(scale);

        // prepare canvas using PDF page dimensions.
        var canvas = document.getElementById('parsing-canvas');
        var context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // prepare rendering context
        var renderContext = {
            canvasContext: context,
            viewport: viewport
        };
   
        return page.render(renderContext).then(() => page.getTextContent())
   } 

    function find(text) {
        text = restoreLines(text);
        
        var headerPosition;
        for (var i=0; i<text.items.length; i++) {
            if (text.items[i].str == "References")
               headerPosition=i;
        }
        if (!headerPosition)
            return [];

        text.items = text.items.slice(headerPosition+1);
        
        var bibliography = {}
        var referenceText = ""
        var referenceItem;
        var re = /\[([0-9, ]+?)\]/g
        for (var i=0; i<text.items.length; i++) {
            
            var m = re.exec(text.items[i].str);
            if (m) {
                if (referenceItem)
                    bibliography[referenceItem] = referenceText;
                referenceText=text.items[i].str;
                referenceItem = m[1];
            }
            else {
                referenceText += "\n" + text.items[i].str;
            }
        }
        if (referenceItem)
            bibliography[referenceItem] = referenceText;
        return bibliography;
    }

    return pdf.getPage(pdf.numPages)
               .then(getText)
                .then(find); 
}

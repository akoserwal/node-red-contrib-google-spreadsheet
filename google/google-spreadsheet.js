var fs = require('fs');
var GoogleSpreadsheet = require('google-spreadsheet');

module.exports = function(RED) {
    "use strict";

    function GoogleConfig(n) {
        RED.nodes.createNode(this,n);
        this.googlecreds = n.googlecreds;
    }
    RED.nodes.registerType("google-config", GoogleConfig);

    function GoogleSpreadSheetOut(config) {
        RED.nodes.createNode(this,config);
        this.googlecreds = config.googlecreds;
        this.spreadsheetKey = config.spreadsheetKey;
        this.worksheetName = config.worksheetName;

        // Retrieve the config node
        this.googleconfig = RED.nodes.getNode(config.googleconfig);

        var node = this;

        try {
            if (this.googleconfig.googlecreds) {
                this.creds = JSON.parse(fs.readFileSync(this.googleconfig.googlecreds, "utf-8"));
            }
        } catch(err) {
            this.valid = false;
            this.error(err.toString());
            return;
        }

        // spreadsheet key is the long id in the sheets URL 
        var doc = new GoogleSpreadsheet(this.spreadsheetKey);


        function findWorksheet(worksheets) {
            for (var i=0; i<worksheets.length; i++) {
                if (worksheets[i].title == node.worksheetName) {
                    return worksheets[i];
                }
            }
        }

        this.on('input', function(msg) {

            var tabularData = msg.payload;

            if (typeof(tabularData) != 'undefined' &&
                typeof(tabularData[0]) != 'undefined' &&
                typeof(tabularData[0][0]) != 'undefined') {

                var rowCount = tabularData.length;
                var colCount = tabularData[0].length;

                doc.useServiceAccountAuth(this.creds, function() {
                    doc.getInfo(function(err, info) {

                        if (typeof(info) == 'undefined' || typeof(info.worksheets) == 'undefined') {
                            node.valid = false;
                            node.error("Spreadsheet Key is unknown!");
                            return;
                        }

                        var sheet = findWorksheet(info.worksheets);  

                        if (typeof(sheet) == 'undefined') {
                            node.valid = false;
                            node.error("Spreadsheet with the name " +  node.worksheetName + " is unknown!");
                            return;
                        }

                        sheet.getCells({
                            'min-row': 1,
                            'max-row': rowCount,
                            'max-col': colCount,
                            'return-empty': true
                        }, function(err, cells) {

                            var i=0;
                            for (var row=0;row<rowCount;row++) {
                                for (var col=0;col<colCount;col++) {
                                    cells[i++].value = tabularData[row][col];
                                }
                            }
                            
                            // bulk updates make it easy to update many cells at once 
                            sheet.bulkUpdateCells(cells,function(err) {
                            }); //async 
                        });
                        
                    });
                });
            }
             
        });
            
    }

    RED.nodes.registerType("google-spreadsheet-out", GoogleSpreadSheetOut);

    function GoogleSpreadSheetIn(config) {
        RED.nodes.createNode(this,config);
        this.googlecreds = config.googlecreds;
        this.spreadsheetKey = config.spreadsheetKey;
        this.worksheetName = config.worksheetName;
        this.minRow = config.minRow;
        this.maxRow = config.maxRow;
        this.minCol = config.minCol;
        this.maxCol = config.maxCol;

        // Retrieve the config node
        this.googleconfig = RED.nodes.getNode(config.googleconfig);

        var node = this;

        try {
            if (this.googleconfig.googlecreds) {
                this.creds = JSON.parse(fs.readFileSync(this.googleconfig.googlecreds, "utf-8"));
            }
        } catch(err) {
            this.valid = false;
            this.error(err.toString());
            return;
        }

        // spreadsheet key is the long id in the sheets URL 
        var doc = new GoogleSpreadsheet(this.spreadsheetKey);


        function findWorksheet(worksheets) {
            for (var i=0; i<worksheets.length; i++) {
                if (worksheets[i].title == node.worksheetName) {
                    return worksheets[i];
                }
            }
        }

        this.on('input', function(msg) {

            msg.payload = [];

            doc.useServiceAccountAuth(this.creds, function() {
                doc.getInfo(function(err, info) {

                    if (typeof(info) == 'undefined' || typeof(info.worksheets) == 'undefined') {
                        node.valid = false;
                        node.error("Spreadsheet Key is unknown!");
                        return;
                    }

                    var sheet = findWorksheet(info.worksheets); 

                    if (typeof(sheet) == 'undefined') {
                        node.valid = false;
                        node.error("Spreadsheet with the name " +  node.worksheetName + " is unknown!");
                        return;
                    }

                    var queryAttr = {};
                    queryAttr["return-empty"] = true;
                    if (node.minRow.length>0) {
                        queryAttr["min-row"] = node.minRow;
                    }
                    if (node.maxRow.length>0) {
                        queryAttr["max-row"] = node.maxRow;
                    }
                    if (node.minCol.length>0) {
                        queryAttr["min-col"] = node.minCol;
                    }
                    if (node.maxCol.length>0) {
                        queryAttr["max-col"] = node.maxCol;
                    }

                    sheet.getCells(queryAttr, function(err, cells) {
                        console.log(cells.length);
                        
                        var rows = [];
                        var cols = [];
                        var prevRow = -1;
                        cells.forEach(function(cell) {
                            if (prevRow!==-1&&cell.row!==prevRow) {
                                rows.push(cols);
                                cols = [];                                   
                            }
                            cols.push(cell.value);
                            prevRow = cell.row;
                        });
                        rows.push(cols);
                        msg.payload = rows;
                        node.send(msg);
                    });
                    
                });
            });
             
        });
            
    }

    RED.nodes.registerType("google-spreadsheet-in", GoogleSpreadSheetIn);
}

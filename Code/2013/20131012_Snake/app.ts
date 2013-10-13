module Snake {
    class Cell {
        constructor(public row: number, public col: number, public td: HTMLTableDataCellElement) {
            var self: Cell = this;
            this.td.onclick = () => {
                Snake.Ctrl.onClickCell(self.row, self.col);
            };
            this.td.className = "cellNone" + ((row + col) % 2);
        }
    }
    class Board {
        width: number;
        height: number;
        cells: Cell[][];
        constructor(contentDiv: HTMLDivElement, width: number, height: number) {
            this.width = width;
            this.height = height;
            var contentHtml: string = "";
            contentHtml += "<table border='0' cellpadding='0' cellspacing='0'>";
            for (var row: number = 0; row < height; row++) {
                contentHtml += "<tr>";
                for (var col: number = 0; col < width; col++) {
                    contentHtml += "<td id=cell_" + row + "_" + col + "></td>";
                }
                contentHtml += "</tr>";
            }
            contentHtml += "</table>";
            contentDiv.innerHTML = contentHtml;
            this.cells = [];
            for (var row: number = 0; row < height; row++) {
                var line = [];
                this.cells.push(line);
                for (var col: number = 0; col < width; col++) {
                    var td: HTMLTableDataCellElement = <HTMLTableDataCellElement>document.getElementById("cell_" + row + "_" + col);
                    line.push(new Cell(row, col, td));
                }
                contentHtml += "</tr>";
            }
        }
    }
    export module Program {
        var contentDiv: HTMLDivElement;
        var width: number = 40;
        var height: number = 30;
        var board: Board;
        export function reset() {
            contentDiv = <HTMLDivElement>document.getElementById("content");
            board = new Board(contentDiv, width, height);
        }
    }
    export module Ctrl {
        import Program = Snake.Program;
        export function onLoad() {
            Program.reset();
        }
        export function onClickCell(row: number, col: number) {
            alert("clicked " + row + " " + col);
        }
    }
}

window.onload = () => {
    Snake.Ctrl.onLoad();
};

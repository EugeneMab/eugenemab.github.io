module Snake {
    class Config {
        height: number = 30;
        width: number = 40;
        timerMillisec: number = 100;
        scoreForMove: number = 1;
        scoreForBonus: number = 1000;
        growthForBonus: number = 2;
    }
    var config = new Config();

    export class Vector {
        constructor(public y: number, public x: number) {
        }
        add(delta: Vector): Vector {
            return new Vector(this.y + delta.y, this.x + delta.x);
        }
    }
    enum CellState {
        none,
        head,
        cursor,
        bonus,
        dead,
    }
    class CellModel {
        constructor(public vec: Vector, public state: CellState) {
        }
    }
    enum Direction {
        right,
        down,
        left,
        up,
    }
    var directionVectors: Vector[] = [
        new Vector(0, 1),
        new Vector(1, 0),
        new Vector(0, -1),
        new Vector(-1, 0),
    ];
    interface IModelContext {
        updateCell(vector: Vector);
        updateScore();
        updateGameover();
    }
    class Model {
        context: IModelContext;
        gameOver: boolean;
        score: number;
        dim: Vector;
        board: CellModel[][];
        private cursors: Vector[];
        private direction: Direction;
        private growth: number;
        reset(context: IModelContext, dim: Vector) {
            this.context = context;
            this.gameOver = false;
            this.score = 0;
            this.dim = dim;
            this.board = new Array<CellModel[]>(this.dim.y);
            for (var y: number = 0; y < dim.y; y++) {
                this.board[y] = new Array<CellModel>(this.dim.x);
                for (var x: number = 0; x < dim.x; x++) {
                    this.board[y][x] = new CellModel(new Vector(y, x), CellState.none);
                }
            }
            var center: Vector = new Vector(Math.floor(this.dim.y / 2), Math.floor(this.dim.x / 2));
            this.cursors = new Array<Vector>(center);
            this.direction = Direction.right;
            this.getCell(center).state = CellState.head;
            this.growth = 0;
            this.createBonus();
        }
        private getCell(vector: Vector): CellModel {
            return this.board[vector.y][vector.x];
        }
        private createBonus() {
            for (; ;) {
                var vec: Vector = new Vector(Math.floor(Math.random() * this.dim.y), Math.floor(Math.random() * this.dim.x));
                var cell: CellModel = this.getCell(vec);
                if (cell.state != CellState.none) {
                    continue;
                }
                cell.state = CellState.bonus;
                this.context.updateCell(vec);
                return;
            }
        }
        move() {
            this.score += config.scoreForMove;
            this.context.updateScore();

            var head: Vector = this.cursors[0];
            this.getCell(head).state = CellState.cursor;
            this.context.updateCell(head);

            var next: Vector = this.wrapAround(head.add(directionVectors[this.direction]));
            var nextCell: CellModel = this.getCell(next);
            switch (nextCell.state) {
                case CellState.none: {
                    this.cursors.splice(0, 0, next);

                    nextCell.state = CellState.head;
                    this.context.updateCell(next);
                    break;
                }
                case CellState.head: {
                    nextCell.state = CellState.dead;
                    this.context.updateCell(next);

                    this.gameOver = true;
                    this.context.updateGameover();
                    break;
                }
                case CellState.cursor: {
                    nextCell.state = CellState.dead;
                    this.context.updateCell(next);

                    this.gameOver = true;
                    this.context.updateGameover();
                    break;
                }
                case CellState.bonus: {
                    this.score += config.scoreForBonus;
                    this.context.updateScore();

                    nextCell.state = CellState.cursor;
                    this.context.updateCell(next);

                    this.growth += config.growthForBonus;
                    this.cursors.splice(0, 0, next);
                    this.createBonus();
                    break;
                }
            }
            if (this.growth != 0) {
                this.growth--;
                return;
            }
            var last = this.cursors[this.cursors.length - 1];
            this.cursors.splice(this.cursors.length - 1, 1);
            this.getCell(last).state = CellState.none;
            this.context.updateCell(last);
        }
        private wrapAround(input: Vector): Vector {
            var y: number = input.y < 0 ? this.dim.y - 1 : input.y >= this.dim.y ? 0 : input.y;
            var x: number = input.x < 0 ? this.dim.x - 1 : input.x >= this.dim.x ? 0 : input.x;
            return new Vector(y, x);
        }
        turn(dir: Direction) {
            if (dir == this.direction) {
                return;
            }
            if (this.getCell(this.wrapAround(this.cursors[0].add(directionVectors[dir]))).state == CellState.cursor) {
                return;
            }
            this.direction = dir;
        }
    }

    class CellView {
        private oddSuffix: string;
        constructor(public cellModel: CellModel, public td: HTMLTableDataCellElement) {
            this.oddSuffix = (this.cellModel.vec.y + this.cellModel.vec.x) % 2 == 0 ? "0" : "1";
            var that: CellView = this;
            this.td.onclick = () => {
                Snake.ctrl.onClickCell(that.cellModel.vec);
            };
            this.td.className = "cell_common cell_" + CellState[this.cellModel.state] + "_" + this.oddSuffix;
        }
        refresh() {
            this.td.className = "cell_common cell_" + CellState[this.cellModel.state] + "_" + this.oddSuffix;
        }
    }
    class View implements IModelContext {
        private model: Model;
        private docElem: HTMLDocument;
        private contentDiv: HTMLDivElement;
        private board: CellView[][];
        private scoreDiv: HTMLDivElement;
        private gameoverDiv: HTMLDivElement;
        reset(model: Model) {
            this.model = model;
            this.docElem = document;
            this.contentDiv = <HTMLDivElement>this.docElem.getElementById("content");
            this.scoreDiv = <HTMLDivElement>this.docElem.getElementById("score");
            this.gameoverDiv = <HTMLDivElement>this.docElem.getElementById("gameover");
            var contentHtml: string = "";
            contentHtml += "<table border='0' cellpadding='0' cellspacing='0'>";
            for (var y: number = 0; y < this.model.dim.y; y++) {
                contentHtml += "<tr>";
                for (var x: number = 0; x < this.model.dim.x; x++) {
                    contentHtml += "<td id=cell_" + y + "_" + x + "></td>";
                }
                contentHtml += "</tr>";
            }
            contentHtml += "</table>";
            this.contentDiv.innerHTML = contentHtml;
            this.board = new Array<CellView[]>(this.model.dim.y);
            for (var y: number = 0; y < this.model.dim.y; y++) {
                this.board[y] = new Array<CellView>(this.model.dim.x);
                for (var x: number = 0; x < this.model.dim.x; x++) {
                    var td: HTMLTableDataCellElement = <HTMLTableDataCellElement>this.docElem.getElementById("cell_" + y + "_" + x);
                    this.board[y][x] = new CellView(this.model.board[y][x], td);
                }
            }
            this.scoreDiv.innerHTML = "Score: " + this.model.score;
            this.gameoverDiv.innerHTML = "";
        }
        updateCell(vector: Vector) {
            if (this.board == null) {
                return;
            }
            this.getCell(vector).refresh();
        }
        private getCell(vector: Vector): CellView {
            return this.board[vector.y][vector.x];
        }
        updateScore() {
            this.scoreDiv.innerHTML = "Score: " + this.model.score;
        }
        updateGameover() {
            if (this.model.gameOver) {
                this.gameoverDiv.innerHTML = "Game Over!"
            }
        }
    }

    enum KeyCode {
        up = 38,
        down = 40,
        left = 37,
        right = 39,
        enter = 13,
    }
    export class Ctrl {
        private model: Model;
        private view: View;
        private timeoutHandle: number = null;
        constructor() {
            var that = this;
            window.onload = () => { that.onLoad(); };
        }
        onLoad() {
            var that = this;
            window.onkeydown = (ev: KeyboardEvent) => { that.onKeyDown(ev); };
            this.onClickRestart();
        }
        onClickRestart() {
            this.model = new Model();
            this.view = new View();
            this.model.reset(this.view, new Vector(config.height, config.width));
            this.view.reset(this.model);
            this.startTimer();
        }
        private startTimer() {
            this.stopTimer();
            var that = this;
            this.timeoutHandle = setTimeout(() => { that.onTimeout(); }, config.timerMillisec);
        }
        private stopTimer() {
            if (this.timeoutHandle == null) {
                return;
            }
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        }
        onClickCell(vec: Vector) {
            var y = vec.y / this.model.dim.y;
            var x = vec.x / this.model.dim.x;
            if (y + x < 1) { // left-top
                if (y - x <= 0) { // top
                    this.model.turn(Direction.up);
                } else { // left
                    this.model.turn(Direction.left);
                }
            } else { // right-bottom
                if (y - x <= 0) { // right
                    this.model.turn(Direction.right);
                } else { // bottom
                    this.model.turn(Direction.down);
                }
            }
        }
        onTimeout() {
            if (this.model.gameOver) {
                return;
            }
            this.startTimer();
            this.model.move();
        }
        onKeyDown(ev: KeyboardEvent) {
            switch (ev.keyCode) {
                case KeyCode.up: {
                    this.model.turn(Direction.up);
                    break;
                }
                case KeyCode.down: {
                    this.model.turn(Direction.down);
                    break;
                }
                case KeyCode.left: {
                    this.model.turn(Direction.left);
                    break;
                }
                case KeyCode.right: {
                    this.model.turn(Direction.right);
                    break;
                }
                case KeyCode.enter: {
                    this.onClickRestart();
                    break;
                }
            }
        }
    }
    export var ctrl = new Ctrl();
}

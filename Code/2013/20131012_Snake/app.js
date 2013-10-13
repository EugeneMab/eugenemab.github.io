var Snake;
(function (Snake) {
    var Config = (function () {
        function Config() {
            this.height = 30;
            this.width = 40;
            this.timerMillisec = 100;
            this.scoreForMove = 1;
            this.scoreForBonus = 1000;
            this.growthForBonus = 2;
        }
        return Config;
    })();
    var config = new Config();

    var Vector = (function () {
        function Vector(y, x) {
            this.y = y;
            this.x = x;
        }
        Vector.prototype.add = function (delta) {
            return new Vector(this.y + delta.y, this.x + delta.x);
        };
        return Vector;
    })();
    Snake.Vector = Vector;
    var CellState;
    (function (CellState) {
        CellState[CellState["none"] = 0] = "none";
        CellState[CellState["head"] = 1] = "head";
        CellState[CellState["cursor"] = 2] = "cursor";
        CellState[CellState["bonus"] = 3] = "bonus";
        CellState[CellState["dead"] = 4] = "dead";
    })(CellState || (CellState = {}));
    var CellModel = (function () {
        function CellModel(vec, state) {
            this.vec = vec;
            this.state = state;
        }
        return CellModel;
    })();
    var Direction;
    (function (Direction) {
        Direction[Direction["right"] = 0] = "right";
        Direction[Direction["down"] = 1] = "down";
        Direction[Direction["left"] = 2] = "left";
        Direction[Direction["up"] = 3] = "up";
    })(Direction || (Direction = {}));
    var directionVectors = [
        new Vector(0, 1),
        new Vector(1, 0),
        new Vector(0, -1),
        new Vector(-1, 0)
    ];

    var Model = (function () {
        function Model() {
        }
        Model.prototype.reset = function (context, dim) {
            this.context = context;
            this.gameOver = false;
            this.score = 0;
            this.dim = dim;
            this.board = new Array(this.dim.y);
            for (var y = 0; y < dim.y; y++) {
                this.board[y] = new Array(this.dim.x);
                for (var x = 0; x < dim.x; x++) {
                    this.board[y][x] = new CellModel(new Vector(y, x), CellState.none);
                }
            }
            var center = new Vector(Math.floor(this.dim.y / 2), Math.floor(this.dim.x / 2));
            this.cursors = new Array(center);
            this.direction = Direction.right;
            this.getCell(center).state = CellState.head;
            this.growth = 0;
            this.createBonus();
        };
        Model.prototype.getCell = function (vector) {
            return this.board[vector.y][vector.x];
        };
        Model.prototype.createBonus = function () {
            for (; ;) {
                var vec = new Vector(Math.floor(Math.random() * this.dim.y), Math.floor(Math.random() * this.dim.x));
                var cell = this.getCell(vec);
                if (cell.state != CellState.none) {
                    continue;
                }
                cell.state = CellState.bonus;
                this.context.updateCell(vec);
                return;
            }
        };
        Model.prototype.move = function () {
            this.score += config.scoreForMove;
            this.context.updateScore();

            var head = this.cursors[0];
            this.getCell(head).state = CellState.cursor;
            this.context.updateCell(head);

            var next = this.wrapAround(head.add(directionVectors[this.direction]));
            var nextCell = this.getCell(next);
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
        };
        Model.prototype.wrapAround = function (input) {
            var y = input.y < 0 ? this.dim.y - 1 : input.y >= this.dim.y ? 0 : input.y;
            var x = input.x < 0 ? this.dim.x - 1 : input.x >= this.dim.x ? 0 : input.x;
            return new Vector(y, x);
        };
        Model.prototype.turn = function (dir) {
            if (dir == this.direction) {
                return;
            }
            if (this.getCell(this.wrapAround(this.cursors[0].add(directionVectors[dir]))).state == CellState.cursor) {
                return;
            }
            this.direction = dir;
        };
        return Model;
    })();

    var CellView = (function () {
        function CellView(cellModel, td) {
            this.cellModel = cellModel;
            this.td = td;
            this.oddSuffix = (this.cellModel.vec.y + this.cellModel.vec.x) % 2 == 0 ? "0" : "1";
            var that = this;
            this.td.onclick = function () {
                Snake.ctrl.onClickCell(that.cellModel.vec);
            };
            this.td.className = "cell_common cell_" + CellState[this.cellModel.state] + "_" + this.oddSuffix;
        }
        CellView.prototype.refresh = function () {
            this.td.className = "cell_common cell_" + CellState[this.cellModel.state] + "_" + this.oddSuffix;
        };
        return CellView;
    })();
    var View = (function () {
        function View() {
        }
        View.prototype.reset = function (model) {
            this.model = model;
            this.docElem = document;
            this.contentDiv = this.docElem.getElementById("content");
            this.scoreDiv = this.docElem.getElementById("score");
            this.gameoverDiv = this.docElem.getElementById("gameover");
            var contentHtml = "";
            contentHtml += "<table border='0' cellpadding='0' cellspacing='0'>";
            for (var y = 0; y < this.model.dim.y; y++) {
                contentHtml += "<tr>";
                for (var x = 0; x < this.model.dim.x; x++) {
                    contentHtml += "<td id=cell_" + y + "_" + x + "></td>";
                }
                contentHtml += "</tr>";
            }
            contentHtml += "</table>";
            this.contentDiv.innerHTML = contentHtml;
            this.board = new Array(this.model.dim.y);
            for (var y = 0; y < this.model.dim.y; y++) {
                this.board[y] = new Array(this.model.dim.x);
                for (var x = 0; x < this.model.dim.x; x++) {
                    var td = this.docElem.getElementById("cell_" + y + "_" + x);
                    this.board[y][x] = new CellView(this.model.board[y][x], td);
                }
            }
            this.scoreDiv.innerHTML = "Score: " + this.model.score;
            this.gameoverDiv.innerHTML = "";
        };
        View.prototype.updateCell = function (vector) {
            if (this.board == null) {
                return;
            }
            this.getCell(vector).refresh();
        };
        View.prototype.getCell = function (vector) {
            return this.board[vector.y][vector.x];
        };
        View.prototype.updateScore = function () {
            this.scoreDiv.innerHTML = "Score: " + this.model.score;
        };
        View.prototype.updateGameover = function () {
            if (this.model.gameOver) {
                this.gameoverDiv.innerHTML = "Game Over!";
            }
        };
        return View;
    })();

    var KeyCode;
    (function (KeyCode) {
        KeyCode[KeyCode["up"] = 38] = "up";
        KeyCode[KeyCode["down"] = 40] = "down";
        KeyCode[KeyCode["left"] = 37] = "left";
        KeyCode[KeyCode["right"] = 39] = "right";
        KeyCode[KeyCode["enter"] = 13] = "enter";
    })(KeyCode || (KeyCode = {}));
    var Ctrl = (function () {
        function Ctrl() {
            this.timeoutHandle = null;
            var that = this;
            window.onload = function () {
                that.onLoad();
            };
        }
        Ctrl.prototype.onLoad = function () {
            var that = this;
            window.onkeydown = function (ev) {
                that.onKeyDown(ev);
            };
            this.onClickRestart();
        };
        Ctrl.prototype.onClickRestart = function () {
            this.model = new Model();
            this.view = new View();
            this.model.reset(this.view, new Vector(config.height, config.width));
            this.view.reset(this.model);
            this.startTimer();
        };
        Ctrl.prototype.startTimer = function () {
            this.stopTimer();
            var that = this;
            this.timeoutHandle = setTimeout(function () {
                that.onTimeout();
            }, config.timerMillisec);
        };
        Ctrl.prototype.stopTimer = function () {
            if (this.timeoutHandle == null) {
                return;
            }
            clearTimeout(this.timeoutHandle);
            this.timeoutHandle = null;
        };
        Ctrl.prototype.onClickCell = function (vec) {
            var y = vec.y / this.model.dim.y;
            var x = vec.x / this.model.dim.x;
            if (y + x < 1) {
                if (y - x <= 0) {
                    this.model.turn(Direction.up);
                } else {
                    this.model.turn(Direction.left);
                }
            } else {
                if (y - x <= 0) {
                    this.model.turn(Direction.right);
                } else {
                    this.model.turn(Direction.down);
                }
            }
        };
        Ctrl.prototype.onTimeout = function () {
            if (this.model.gameOver) {
                return;
            }
            this.startTimer();
            this.model.move();
        };
        Ctrl.prototype.onKeyDown = function (ev) {
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
        };
        return Ctrl;
    })();
    Snake.Ctrl = Ctrl;
    Snake.ctrl = new Ctrl();
})(Snake || (Snake = {}));
//# sourceMappingURL=app.js.map

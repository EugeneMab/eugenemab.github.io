module Snake {
    export module Program {
        var contentDiv: HTMLDivElement;
        export function reset() {
            this.contentDiv = <HTMLDivElement>document.getElementById("content");
            this.contentDiv.innerHTML = "Hello";
        }
    }
    export module Ctrl {
        import Program = Snake.Program;
        export function onLoad() {
            Program.reset();
        }
    }
}

window.onload = () => {
    Snake.Ctrl.onLoad();
};

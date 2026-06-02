// src/step19.vitest.test.ts
import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer.js";
import { Parser } from "./parser.js";
import { Compiler } from "./compiler.js";
import { getJSRuntime, runJS } from "./test-utils.js";

async function runPython(code: string) {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const compiler = new Compiler();
  const jsCode = compiler.compileJS(ast);

  const logs: any[] = [];
  const runtime = getJSRuntime(logs);
  const globals = await runJS(jsCode, runtime);
  return { globals, logs, jsCode };
}

describe("Step 19: Classes & Inheritance", () => {
  it("should support basic class definition and instantiation", async () => {
    const code = `
class Point:
    def __init__(self, x, y):
        self.x = x
        self.y = y
    def get_coords(self):
        return (self.x, self.y)

def test():
    p = Point(10, 20)
    return p.get_coords()
`;
    const { globals } = await runPython(code);
    const result = await globals.test();
    expect(result.toString()).toBe("(10, 20)");
  });

  it("should support inheritance and super()", async () => {
    const code = `
class Shape:
    def __init__(self, color):
        self.color = color

class Circle(Shape):
    def __init__(self, color, radius):
        super().__init__(color)
        self.radius = radius
    def describe(self):
        return f"{self.color} circle with radius {self.radius}"

def test():
    c = Circle("red", 5)
    return c.describe()
`;
    const { globals } = await runPython(code);
    expect(await globals.test()).toBe("red circle with radius 5");
  });

  it("should support method overriding", async () => {
    const code = `
class A:
    def greet(self):
        return "Hello from A"

class B(A):
    def greet(self):
        return "Hello from B"

def test():
    a = A()
    b = B()
    return a.greet() + " " + b.greet()
`;
    const { globals } = await runPython(code);
    expect(await globals.test()).toBe("Hello from A Hello from B");
  });

  it("should support static class variables", async () => {
    const code = `
class Counter:
    count = 0
    def __init__(self):
        Counter.count = Counter.count + 1

def test():
    a = Counter()
    b = Counter()
    return Counter.count
`;
    const { globals } = await runPython(code);
    expect(await globals.test()).toBe(2);
  });

  it("should support keyword arguments in constructor", async () => {
    const code = `
class User:
    def __init__(self, name, age=0):
        self.name = name
        self.age = age

def test():
    u = User(age=25, name="Alice")
    return f"{u.name} is {u.age}"
`;
    const { globals } = await runPython(code);
    expect(await globals.test()).toBe("Alice is 25");
  });

  it("should support keyword arguments in methods", async () => {
    const code = `
class Greeter:
    def greet(self, name, prefix="Hello"):
        return f"{prefix}, {name}"

def test():
    g = Greeter()
    return g.greet(prefix="Hi", name="Bob")
`;
    const { globals } = await runPython(code);
    expect(await globals.test()).toBe("Hi, Bob");
  });
});

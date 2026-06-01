def main():
    class Animal:
        def __init__(self, name):
            self.name = name
        def speak(self):
            return f"{self.name} makes a noise"

    class Dog(Animal):
        def __init__(self, name, breed="Unknown"):
            super().__init__(name)
            self.breed = breed
        def speak(self):
            return f"{self.name} the {self.breed} barks"

    a = Animal("Generic")
    d1 = Dog("Buddy", breed="Golden Retriever")
    d2 = Dog("Max")
    
    print(a.speak())
    print(d1.speak())
    print(d2.speak())
    
    return d1.name

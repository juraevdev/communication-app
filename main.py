class Person:
    def __init__(self, name, age):
        self.name = name
        self.age = age

    # __str__ yo‘q
    def __repr__(self):
        return f"Person(name={self.name!r}, age={self.age!r})"


p = Person("Ali", 25)

# print chaqirilganda __str__ yo‘q bo‘lsa, __repr__ ishlaydi
print(p)  
# Output: Person(name='Ali', age=25)

# Interaktiv konsolda yoki repr(p) chaqirilganda ham __repr__ ishlaydi
p  
# Output: Person(name='Ali', age=25)


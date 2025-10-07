/**
 * Comprehensive test cases for all supported programming languages
 * These tests validate syntax, compilation, execution, and error handling
 */

export interface LanguageTestCase {
  id: string;
  name: string;
  description: string;
  code: string;
  input?: string;
  expectedOutput?: string;
  expectedError?: string;
  category: 'basic' | 'intermediate' | 'advanced' | 'error' | 'edge-case';
  timeout?: number;
  shouldCompile?: boolean;
  shouldExecute?: boolean;
}

export const LANGUAGE_TEST_CASES: Record<string, LanguageTestCase[]> = {
  javascript: [
    {
      id: 'js-basic-1',
      name: 'Hello World',
      description: 'Basic console output',
      code: 'console.log("Hello, World!");',
      expectedOutput: 'Hello, World!',
      category: 'basic',
      shouldExecute: true
    },
    {
      id: 'js-basic-2',
      name: 'Variables and Math',
      description: 'Variable declaration and arithmetic operations',
      code: `
let a = 10;
let b = 20;
console.log("Sum:", a + b);
console.log("Product:", a * b);
console.log("Division:", b / a);
      `,
      expectedOutput: 'Sum: 30',
      category: 'basic',
      shouldExecute: true
    },
    {
      id: 'js-intermediate-1',
      name: 'Functions',
      description: 'Function definition and calling',
      code: `
function greet(name) {
  return "Hello, " + name + "!";
}

function add(a, b) {
  return a + b;
}

console.log(greet("Alice"));
console.log("5 + 3 =", add(5, 3));
      `,
      expectedOutput: 'Hello, Alice!',
      category: 'intermediate',
      shouldExecute: true
    },
    {
      id: 'js-intermediate-2',
      name: 'Arrays and Loops',
      description: 'Array manipulation and loop constructs',
      code: `
const numbers = [1, 2, 3, 4, 5];
let sum = 0;

for (let i = 0; i < numbers.length; i++) {
  sum += numbers[i];
}

console.log("Array:", numbers);
console.log("Sum:", sum);
console.log("Average:", sum / numbers.length);
      `,
      expectedOutput: 'Array: [1, 2, 3, 4, 5]',
      category: 'intermediate',
      shouldExecute: true
    },
    {
      id: 'js-error-1',
      name: 'Syntax Error',
      description: 'Invalid JavaScript syntax',
      code: 'console.log("Hello";', // Missing closing parenthesis
      expectedError: 'SyntaxError',
      category: 'error',
      shouldExecute: false
    },
    {
      id: 'js-error-2',
      name: 'Runtime Error',
      description: 'Division by zero',
      code: `
let x = 10;
let y = 0;
console.log(x / y);
      `,
      expectedOutput: 'Infinity',
      category: 'error',
      shouldExecute: true
    }
  ],

  python: [
    {
      id: 'py-basic-1',
      name: 'Hello World',
      description: 'Basic print statement',
      code: 'print("Hello, World!")',
      expectedOutput: 'Hello, World!',
      category: 'basic',
      shouldExecute: true
    },
    {
      id: 'py-basic-2',
      name: 'Variables and Math',
      description: 'Variable assignment and arithmetic',
      code: `
a = 15
b = 25
print(f"Sum: {a + b}")
print(f"Product: {a * b}")
print(f"Division: {b / a}")
      `,
      expectedOutput: 'Sum: 40',
      category: 'basic',
      shouldExecute: true
    },
    {
      id: 'py-intermediate-1',
      name: 'Functions and Lists',
      description: 'Function definition and list operations',
      code: `
def greet(name):
    return f"Hello, {name}!"

def calculate_average(numbers):
    return sum(numbers) / len(numbers)

names = ["Alice", "Bob", "Charlie"]
for name in names:
    print(greet(name))

numbers = [10, 20, 30, 40, 50]
print(f"Average: {calculate_average(numbers)}")
      `,
      expectedOutput: 'Hello, Alice!',
      category: 'intermediate',
      shouldExecute: true
    },
    {
      id: 'py-intermediate-2',
      name: 'File I/O Simulation',
      description: 'String processing and input handling',
      code: `
# Simulate file input
input_data = "Hello\nWorld\nPython"
lines = input_data.split('\\n')

for i, line in enumerate(lines, 1):
    print(f"Line {i}: {line}")

print(f"Total lines: {len(lines)}")
      `,
      expectedOutput: 'Line 1: Hello',
      category: 'intermediate',
      shouldExecute: true
    },
    {
      id: 'py-error-1',
      name: 'Indentation Error',
      description: 'Invalid Python indentation',
      code: `
def test():
print("This will fail")
      `,
      expectedError: 'IndentationError',
      category: 'error',
      shouldExecute: false
    },
    {
      id: 'py-error-2',
      name: 'Name Error',
      description: 'Undefined variable',
      code: `
print(undefined_variable)
      `,
      expectedError: 'NameError',
      category: 'error',
      shouldExecute: false
    }
  ],

  java: [
    {
      id: 'java-basic-1',
      name: 'Hello World',
      description: 'Basic Java program with main method',
      code: `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}
      `,
      expectedOutput: 'Hello, World!',
      category: 'basic',
      shouldCompile: true,
      shouldExecute: true
    },
    {
      id: 'java-basic-2',
      name: 'Variables and Math',
      description: 'Variable declaration and arithmetic operations',
      code: `
public class Main {
    public static void main(String[] args) {
        int a = 25;
        int b = 35;
        
        System.out.println("Sum: " + (a + b));
        System.out.println("Product: " + (a * b));
        System.out.println("Division: " + ((double)b / a));
    }
}
      `,
      expectedOutput: 'Sum: 60',
      category: 'basic',
      shouldCompile: true,
      shouldExecute: true
    },
    {
      id: 'java-intermediate-1',
      name: 'Methods and Arrays',
      description: 'Method definition and array manipulation',
      code: `
public class Main {
    public static void main(String[] args) {
        int[] numbers = {1, 2, 3, 4, 5};
        
        System.out.println("Array elements:");
        for (int num : numbers) {
            System.out.print(num + " ");
        }
        
        System.out.println("\\nSum: " + calculateSum(numbers));
        System.out.println("Average: " + calculateAverage(numbers));
    }
    
    public static int calculateSum(int[] arr) {
        int sum = 0;
        for (int num : arr) {
            sum += num;
        }
        return sum;
    }
    
    public static double calculateAverage(int[] arr) {
        return (double) calculateSum(arr) / arr.length;
    }
}
      `,
      expectedOutput: 'Array elements:',
      category: 'intermediate',
      shouldCompile: true,
      shouldExecute: true
    },
    {
      id: 'java-error-1',
      name: 'Compilation Error',
      description: 'Missing semicolon',
      code: `
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!")
    }
}
      `,
      expectedError: 'compilation_error',
      category: 'error',
      shouldCompile: false,
      shouldExecute: false
    },
    {
      id: 'java-error-2',
      name: 'Runtime Error',
      description: 'Array index out of bounds',
      code: `
public class Main {
    public static void main(String[] args) {
        int[] arr = {1, 2, 3};
        System.out.println(arr[5]);
    }
}
      `,
      expectedError: 'runtime_error',
      category: 'error',
      shouldCompile: true,
      shouldExecute: false
    }
  ],

  cpp: [
    {
      id: 'cpp-basic-1',
      name: 'Hello World',
      description: 'Basic C++ program with iostream',
      code: `
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}
      `,
      expectedOutput: 'Hello, World!',
      category: 'basic',
      shouldCompile: true,
      shouldExecute: true
    },
    {
      id: 'cpp-basic-2',
      name: 'Variables and Math',
      description: 'Variable declaration and arithmetic',
      code: `
#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    int a = 30;
    int b = 40;
    
    cout << "Sum: " << a + b << endl;
    cout << "Product: " << a * b << endl;
    cout << "Division: " << fixed << setprecision(2) << (double)b / a << endl;
    
    return 0;
}
      `,
      expectedOutput: 'Sum: 70',
      category: 'basic',
      shouldCompile: true,
      shouldExecute: true
    },
    {
      id: 'cpp-intermediate-1',
      name: 'Functions and Vectors',
      description: 'Function definition and vector operations',
      code: `
#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int calculateSum(const vector<int>& numbers) {
    int sum = 0;
    for (int num : numbers) {
        sum += num;
    }
    return sum;
}

double calculateAverage(const vector<int>& numbers) {
    return (double) calculateSum(numbers) / numbers.size();
}

int main() {
    vector<int> numbers = {10, 20, 30, 40, 50};
    
    cout << "Numbers: ";
    for (int num : numbers) {
        cout << num << " ";
    }
    cout << endl;
    
    cout << "Sum: " << calculateSum(numbers) << endl;
    cout << "Average: " << calculateAverage(numbers) << endl;
    
    return 0;
}
      `,
      expectedOutput: 'Numbers: 10 20 30 40 50',
      category: 'intermediate',
      shouldCompile: true,
      shouldExecute: true
    },
    {
      id: 'cpp-error-1',
      name: 'Compilation Error',
      description: 'Missing semicolon',
      code: `
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl
    return 0;
}
      `,
      expectedError: 'compilation_error',
      category: 'error',
      shouldCompile: false,
      shouldExecute: false
    },
    {
      id: 'cpp-error-2',
      name: 'Runtime Error',
      description: 'Division by zero',
      code: `
#include <iostream>
using namespace std;

int main() {
    int a = 10;
    int b = 0;
    cout << a / b << endl;
    return 0;
}
      `,
      expectedError: 'runtime_error',
      category: 'error',
      shouldCompile: true,
      shouldExecute: false
    }
  ],

  c: [
    {
      id: 'c-basic-1',
      name: 'Hello World',
      description: 'Basic C program with stdio.h',
      code: `
#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    return 0;
}
      `,
      expectedOutput: 'Hello, World!',
      category: 'basic',
      shouldCompile: true,
      shouldExecute: true
    },
    {
      id: 'c-basic-2',
      name: 'Variables and Math',
      description: 'Variable declaration and arithmetic operations',
      code: `
#include <stdio.h>

int main() {
    int a = 35;
    int b = 45;
    
    printf("Sum: %d\\n", a + b);
    printf("Product: %d\\n", a * b);
    printf("Division: %.2f\\n", (double)b / a);
    
    return 0;
}
      `,
      expectedOutput: 'Sum: 80',
      category: 'basic',
      shouldCompile: true,
      shouldExecute: true
    },
    {
      id: 'c-intermediate-1',
      name: 'Functions and Arrays',
      description: 'Function definition and array manipulation',
      code: `
#include <stdio.h>

int calculateSum(int arr[], int size) {
    int sum = 0;
    for (int i = 0; i < size; i++) {
        sum += arr[i];
    }
    return sum;
}

double calculateAverage(int arr[], int size) {
    return (double) calculateSum(arr, size) / size;
}

int main() {
    int numbers[] = {15, 25, 35, 45, 55};
    int size = sizeof(numbers) / sizeof(numbers[0]);
    
    printf("Numbers: ");
    for (int i = 0; i < size; i++) {
        printf("%d ", numbers[i]);
    }
    printf("\\n");
    
    printf("Sum: %d\\n", calculateSum(numbers, size));
    printf("Average: %.2f\\n", calculateAverage(numbers, size));
    
    return 0;
}
      `,
      expectedOutput: 'Numbers: 15 25 35 45 55',
      category: 'intermediate',
      shouldCompile: true,
      shouldExecute: true
    },
    {
      id: 'c-error-1',
      name: 'Compilation Error',
      description: 'Missing semicolon',
      code: `
#include <stdio.h>

int main() {
    printf("Hello, World!"\\n)
    return 0;
}
      `,
      expectedError: 'compilation_error',
      category: 'error',
      shouldCompile: false,
      shouldExecute: false
    },
    {
      id: 'c-error-2',
      name: 'Runtime Error',
      description: 'Buffer overflow simulation',
      code: `
#include <stdio.h>
#include <string.h>

int main() {
    char buffer[5];
    strcpy(buffer, "This is too long for the buffer");
    printf("%s\\n", buffer);
    return 0;
}
      `,
      expectedError: 'runtime_error',
      category: 'error',
      shouldCompile: true,
      shouldExecute: false
    }
  ]
};

/**
 * Get test cases for a specific language
 */
export function getTestCases(language: string): LanguageTestCase[] {
  return LANGUAGE_TEST_CASES[language] || [];
}

/**
 * Get test cases by category
 */
export function getTestCasesByCategory(language: string, category: string): LanguageTestCase[] {
  const allTests = getTestCases(language);
  return allTests.filter(test => test.category === category);
}

/**
 * Get basic test cases for a language
 */
export function getBasicTests(language: string): LanguageTestCase[] {
  return getTestCasesByCategory(language, 'basic');
}

/**
 * Get error test cases for a language
 */
export function getErrorTests(language: string): LanguageTestCase[] {
  return getTestCasesByCategory(language, 'error');
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(LANGUAGE_TEST_CASES);
}

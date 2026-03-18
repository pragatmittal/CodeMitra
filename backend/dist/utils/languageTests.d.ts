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
export declare const LANGUAGE_TEST_CASES: Record<string, LanguageTestCase[]>;
export declare function getTestCases(language: string): LanguageTestCase[];
export declare function getTestCasesByCategory(language: string, category: string): LanguageTestCase[];
export declare function getBasicTests(language: string): LanguageTestCase[];
export declare function getErrorTests(language: string): LanguageTestCase[];
export declare function getSupportedLanguages(): string[];
//# sourceMappingURL=languageTests.d.ts.map
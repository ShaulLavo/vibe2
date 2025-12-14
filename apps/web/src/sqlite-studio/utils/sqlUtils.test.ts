import { describe, it, expect } from 'bun:test'
import { splitStatements } from './sqlUtils'

describe('splitStatements', () => {
	it('splits simple statements', () => {
		const input = `SELECT * FROM users;
      SELECT * FROM posts;`
		expect(splitStatements(input)).toEqual([
			'SELECT * FROM users;',
			'SELECT * FROM posts;',
		])
	})

	it('handles irregular whitespace', () => {
		const input = `  SELECT 1  ;  
       SELECT 2;  `
		expect(splitStatements(input)).toEqual(['SELECT 1  ;', 'SELECT 2;'])
	})

	it('does NOT split on semicolons inside single quotes', () => {
		const input = `SELECT 'a;b';`
		const result = splitStatements(input)
		expect(result).toEqual(["SELECT 'a;b';"])
	})

	it('handles escaped single quotes', () => {
		const input = `SELECT 'a''b;c';`
		const result = splitStatements(input)
		expect(result).toEqual(["SELECT 'a''b;c';"])
	})

	it('does NOT split on semicolons inside double quotes', () => {
		const input = `SELECT "col;name";`
		const result = splitStatements(input)
		expect(result).toEqual(['SELECT "col;name";'])
	})

	it('handles block comments', () => {
		const input = `/* 
      comment with ; 
    */
    SELECT 1;`
		const result = splitStatements(input)
		expect(result.length).toBe(1)
		expect(result[0]).toContain('comment with ;')
		expect(result[0]).toContain('SELECT 1;')
	})

	it('handles line comments behavior', () => {
		// Case 1: Semicolon inside comment preventing split
		const inputComment = `SELECT 1 -- comment ; without split`
		const res0 = splitStatements(inputComment)
		expect(res0.length).toBe(1)
		expect(res0[0]).toContain('SELECT 1')

		// Case 2: Semicolon terminates statement. Trailing comment becomes separate "statement" (or junk)
		const inputAfter = `SELECT 1; -- comment`
		const res1 = splitStatements(inputAfter)
		expect(res1[0]).toBe('SELECT 1;')
		expect(res1?.[1]?.trim()).toStartWith('--')

		// Case 3: Semicolon is ignored inside comment, actual semicolon follows
		const input2 = `SELECT 1 -- comm ; ent
     ;`
		const res2 = splitStatements(input2)
		expect(res2.length).toBe(1)
		expect(res2[0]).toContain('SELECT 1')
	})
})

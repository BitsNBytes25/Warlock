import {test} from 'node:test';
import assert from 'node:assert';
import {diffObjects} from '../libs/diff_objects.mjs';

test('diffObjects - Simple Strings', async (t) => {
	let dat1, dat2;

	// Test different values
	dat1 = {'key': 'value1'};
	dat2 = {'key': 'value2'};
	assert.deepEqual(diffObjects(dat1, dat2), {'key': 'value2'});

	// Test same values
	dat1 = {'key': 'value1'};
	dat2 = {'key': 'value1'};
	assert.deepEqual(diffObjects(dat1, dat2), {});

	// Test different keys
	dat1 = {'key1': 'value1'};
	dat2 = {'key2': 'value2'};
	assert.deepEqual(diffObjects(dat1, dat2), {'key2': 'value2'});
});

test('diffObjects - Arrays', async (t) => {
	let dat1, dat2;

	// Test different values
	dat1 = {'key': ['value1']};
	dat2 = {'key': ['value2']};
	assert.deepEqual(diffObjects(dat1, dat2), {'key': ['value2']});

	// Test same values
	dat1 = {'key': ['value1']};
	dat2 = {'key': ['value1']};
	assert.deepEqual(diffObjects(dat1, dat2), {});
});

test('diffObjects - Nested Objects', async (t) => {
	let dat1, dat2;

	// Test different values
	dat1 = {'key': {'subkey': 'value1'}};
	dat2 = {'key': {'subkey': 'value2'}};
	assert.deepEqual(diffObjects(dat1, dat2), {'key': {'subkey': 'value2'}});

	// Test same values
	dat1 = {'key': {'subkey': 'value1'}};
	dat2 = {'key': {'subkey': 'value1'}};
	assert.deepEqual(diffObjects(dat1, dat2), {});
});

test('diffObjects - Array of Objects', async (t) => {
	let dat1, dat2;

	// Test different values
	dat1 = {'key': [{'subkey': 'value1'}]};
	dat2 = {'key': [{'subkey': 'value2'}]};
	assert.deepEqual(diffObjects(dat1, dat2), {'key': [{'subkey': 'value2'}]});

	// Test same values
	dat1 = {'key': [{'subkey': 'value1'}]};
	dat2 = {'key': [{'subkey': 'value1'}]};
	assert.deepEqual(diffObjects(dat1, dat2), {});
});

test('diffObjects - Not Objects', async (t) => {
	let dat1, dat2;

	// Test object 1 is not an object
	dat1 = null;
	dat2 = {'key': 'value1'};
	assert.deepEqual(diffObjects(dat1, dat2), {'key': 'value1'});
});

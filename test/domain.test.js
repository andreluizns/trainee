import assert from 'node:assert/strict';
import { test } from 'node:test';
import { classificar, haversine } from '../src/domain.js';

test('haversine reproduz a distância do exemplo do enunciado', () => {
  assert.equal(haversine(-10.07996, -37.08384, -10.07987, -37.08389), 11.406788673336607);
});

test('haversine de um ponto com ele mesmo é zero', () => {
  assert.equal(haversine(-10.07996, -37.08384, -10.07996, -37.08384), 0);
});

test('haversine é simétrico', () => {
  assert.equal(
    haversine(-31.93195, -40.61438, -31.93187, -40.61435),
    haversine(-31.93187, -40.61435, -31.93195, -40.61438),
  );
});

const restricoes = new Map([[9, new Set([10, 11])]]);

test('protetiva vale nos dois sentidos e para qualquer agressor da lista', () => {
  assert.equal(classificar(9, -1, 10, 3, restricoes), 'protetiva');
  assert.equal(classificar(11, 3, 9, -1, restricoes), 'protetiva');
});

test('mesma facção preenchida é faccao', () => {
  assert.equal(classificar(1, 2, 3, 2, restricoes), 'faccao');
});

test('facção vazia nos dois não é faccao', () => {
  assert.equal(classificar(1, -1, 3, -1, restricoes), 'generico');
});

test('facções diferentes são generico', () => {
  assert.equal(classificar(1, 1, 3, 2, restricoes), 'generico');
});

test('vítima com quem não é seu agressor é generico', () => {
  assert.equal(classificar(9, -1, 12, -1, restricoes), 'generico');
  assert.equal(classificar(9, -1, 12, 4, restricoes), 'generico');
});

test('protetiva tem prioridade sobre faccao', () => {
  assert.equal(classificar(9, 1, 10, 1, restricoes), 'protetiva');
});

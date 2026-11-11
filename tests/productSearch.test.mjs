import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findProductByQuery, productPriceInput } from '../src/utils/productSearch.ts'

const products = [
  { id: 7, codigo: 'CA-01', nombre: 'Café', precio: 1500 },
  { id: 8, codigo: 'PA-02', nombre: 'Pan', precio: 800 },
]

test('busca por código y nombre sin distinguir mayúsculas y prioriza coincidencias exactas', () => {
  assert.equal(findProductByQuery(products, ' ca-01 '), products[0])
  assert.equal(findProductByQuery(products, 'pan'), products[1])
  assert.equal(findProductByQuery(products, 'pa-'), products[1])
  assert.equal(findProductByQuery(products, '7'), products[0])
  assert.equal(findProductByQuery(products, ''), null)
  assert.equal(findProductByQuery(products, 'inexistente'), null)
  assert.equal(findProductByQuery(products, 'ca-01').precio, 1500)
})

test('solo completa precios válidos, incluyendo productos gratuitos', () => {
  assert.equal(productPriceInput(products[0]), '1500')
  assert.equal(productPriceInput({ ...products[0], precio: 0 }), '0')
  assert.equal(productPriceInput({ ...products[0], precio: NaN }), '')
  assert.equal(productPriceInput({ ...products[0], precio: -1 }), '')
  assert.equal(productPriceInput(null), '')
})

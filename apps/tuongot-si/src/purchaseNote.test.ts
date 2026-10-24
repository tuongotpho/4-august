import { describe, expect, it } from 'vitest'
import { purchaseTransferNote } from './invoiceImage'
import { asciiNote } from './logic'
import type { Purchase } from './types'

describe('nội dung CK phiếu nhập', () => {
  it('ngày nhập ddmmyyyy + thanh toán Tương ớt, QR bỏ dấu', () => {
    const note = purchaseTransferNote({ date: '2026-10-23' } as Purchase)
    expect(note).toBe('23102026 thanh toán Tương ớt')
    expect(asciiNote(note)).toBe('23102026 thanh toan Tuong ot')
  })
})

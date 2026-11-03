/**
 * Custom Jest transform using sucrase for fast TypeScript transformation.
 *
 * sucrase is a lightweight alternative to Babel that supports:
 *   - TypeScript type annotations
 *   - import/export syntax
 *   - JSX
 *   - as casts
 */

const { transform } = require('sucrase');

module.exports = {
  /**
   * Transform a source file for Jest.
   *
   * @param {string} src   Source code
   * @param {string} filename  Absolute path
   * @returns {{ code: string, map: string | null }}
   */
  process(src, filename) {
    const result = transform(src, {
      transforms: ['typescript', 'imports'],
    });

    return { code: result.code, map: null };
  },
};

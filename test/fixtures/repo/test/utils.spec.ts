import { add, subtract, multiply, divide } from '../src/utils';

describe('Utils', () => {
  describe('add', () => {
    it('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5);
    });
  });

  describe('subtract', () => {
    it('should subtract two positive numbers', () => {
      expect(subtract(5, 3)).toBe(2);
    });
  });

  // Note: multiply, divide, isEven, isOdd are not tested (simulating low coverage)
});

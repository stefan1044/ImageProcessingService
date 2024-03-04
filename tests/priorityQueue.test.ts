import PriorityQueue from '../src/shared/priorityQueue/priorityQueue';

test('Priority queue should be empty upon initialization', () => {
  const priorityQueue = new PriorityQueue();

  expect(priorityQueue.getSize() == 0);
});

test('Should get correct element', () => {
  const priorityQueue = new PriorityQueue();

  priorityQueue.enqueue(2, 2);
  priorityQueue.enqueue(3, 3);

  expect(priorityQueue.dequeue() == 2);
});

test('Should be empty after queueing', () => {
  const priorityQueue = new PriorityQueue();

  for (let i = 0; i < 3; i++) priorityQueue.enqueue(i, i);
  for (let i = 0; i < 3; i++) priorityQueue.dequeue();

  expect(priorityQueue.getSize() == 0);
});

test('Clone should return correct object', () => {
  const priorityQueue = new PriorityQueue();

  priorityQueue.enqueue(1, 1);

  expect(priorityQueue.peek() == 1);
});

test('Modifying priority should work', () => {
  const priorityQueue = new PriorityQueue();

  priorityQueue.enqueue(1, 1);
  priorityQueue.enqueue(2, 2);

  priorityQueue.modifyPriority((item) => item == 1, 2);

  expect(priorityQueue.dequeue() == 1);
});

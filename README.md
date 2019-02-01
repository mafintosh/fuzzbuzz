# fuzzbuzz

Fuzz testing framework

```
npm install fuzzbuzz
```

## Usage

``` js
const FuzzBuzz = require('fuzzbuzz')

const fuzz = new FuzzBuzz({
  async setup () {
    console.log('do some initial setup')
    await sleep(100)
  },
  async validate () {
    console.log('validate your state')
    await sleep(100)
  }
})

// print out the random seed so things can be reproduced
console.log('random seed is', fuzz.seed)

// add an operation
fuzz.add(1, async function () {
  console.log('hi')
  await sleep(100)
})

// add another one that should be called ~10 times more
fuzz.add(10, async function () {
  console.log('ho')
  await sleep(100)
})

// run 20 operations
fuzz.run(20)

function sleep (n) {
  return new Promise(resolve => setTimeout(resolve, n))
}
```

## API

#### `fuzz = new FuzzBuzz([options])`

Make a new fuzz tester. Options include:

``` js
{
  seed: ..., // pass in a random seed here (32 byte buffer or hex string)
  async setup(), // pass in a section function that is run before operations
  async validate() // pass in validator that is run after all operations are done
}
```

#### `fuzz.add(weight, async fn)`

Add a testing operation. `weight` should be a positive integer indicating the ratio you wanna
call this operation compared to other ones.

`fn` should be a function that does some testing function. Internally it is `awaited` so it is
same to make this an async function. If you are testing a callback API accept a callback in the fn
signature like so `fn(callback)`.

#### `fuzz.remove(weight, fn)`

Remove an operation again.

#### `promise = fuzz.run(times)`

Run the fuzzer. First runs the setup function, then runs `times` operations where
each operation is picked randomly based on their relative weight. After the operations
are done, the validate function is run.

The randomness that is used to pick each operation is based on the seed from the constructor
so if you pass the same seed twice the order is deterministic.

#### `promise<minRuns> = fuzz.bisect(maxTimes)`

Using a bisection algorithm the fuzzer will find the minimum amount of runs
for either your validation function to fail or for an operation to throw.

The returned minimum amount of runs are returned afterwards.

#### `item = fuzz.pick(array)`

Pick a random element from an array. Uses the random seed as well.

#### `num = fuzz.random()`

Roll a random number between 0 and 1. Uses the random seed as well.

#### `integer = fuzz.randomInt(max)`

Helper to roll a random integer.

#### `promise = fuzz.call(operations)`

Call a random function from an array of weighted functions. Uses the random seed as well.

The operations array should be an array of `[ weight, async fn ]` pairs.

#### `fuzz.setup(async fn)`

Set the setup function after constructing the fuzzer.

#### `fuzz.validate(async fn)`

Set the validate function after constructing the fuzzer.

## License

MIT

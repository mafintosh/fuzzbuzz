const FuzzBuzz = require('./')

const fuzz = new FuzzBuzz({
  async setup () {
    console.log('doing setup')
    await sleep(100)
  },
  async validate () {
    console.log('validating state')
    await sleep(100)
  }
})

console.log('seed is', fuzz.seed)

fuzz.add(1, async function () {
  console.log('hi')
  await sleep(100)
})

fuzz.add(10, async function () {
  console.log('ho')
  await sleep(100)
})

fuzz.run(20)

function sleep (n) {
  return new Promise(resolve => setTimeout(resolve, n))
}

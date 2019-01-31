const random = require('math-random-seed')

class FuzzBuzz {
  constructor (opts) {
    if (!opts) opts = {}

    this.operations = []
    this.random = random(opts.seed && (Buffer.isBuffer(opts.seed) ? opts.seed : Buffer.from(opts.seed, 'hex')))
    this.seed = this.random.seed.toString('hex')

    if (opts.setup) this._setup = promisify(opts.setup)
    if (opts.validate) this._validate = promisify(opts.validate)

    const operations = opts.operations || []
    for (const [ weight, fn ] of operations) this.add(weight, fn)
  }

  setup (fn) {
    this._setup = promisify(fn)
  }

  validate (fn) {
    this._validate = promisify(fn)
  }

  add (weight, fn) {
    this.operations.push([ weight, promisify(fn), fn ])
  }

  remove (weight, fn) {
    for (let i = 0; i < this.operations.length; i++) {
      const [ otherWeight, , otherFn ] = this.operations[i]

      if (weight === otherWeight && otherFn === fn) {
        this.operations.splice(i, 1)
        return true
      }
    }

    return false
  }

  async call (ops) {
    let totalWeight = 0
    for (const [ weight ] of ops) totalWeight += weight
    let n = this.random() * totalWeight
    for (const [ weight, op ] of ops) {
      n -= weight
      if (n <= 0) return op.call(this)
    }
  }

  randomInt (n) {
    return Math.floor(this.random() * n)
  }

  pick (items) {
    return items.length ? items[this.randomInt()] : null
  }

  async run (n) {
    await this._setup()
    for (let i = 0; i < n; i++) await this.call(this.operations)
    await this._validate()
  }

  _setup () {
    // overwrite me
  }

  _validate () {
    // overwrite me
  }
}

module.exports = FuzzBuzz

function promisify (fn) {
  if (fn.length !== 1) return fn
  return function () {
    return new Promise(function (resolve, reject) {
      fn(function (err) {
        if (err) return reject(err)
        else resolve()
      })
    })
  }
}

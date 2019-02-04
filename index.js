const random = require('math-random-seed')
const { promisify } = require('util')
const { randomBytes, createHash } = require('crypto')

class FuzzBuzz {
  constructor (opts) {
    if (!opts) opts = {}

    this.seed = opts.seed || randomBytes(32).toString('hex')
    this.random = random(createHash('sha256').update(this.seed).digest())
    this.operations = []
    this.debugging = !!opts.debugging || (process.env.DEBUG || '').indexOf('fuzzbuzz') > -1

    if (opts.setup) this._setup = promisifyMaybe(opts.setup)
    if (opts.validate) this._validate = promisifyMaybe(opts.validate)

    const operations = opts.operations || []
    for (const [ weight, fn ] of operations) this.add(weight, fn)

    this.debug('seed is ' + this.seed)
  }

  setup (fn) {
    this._setup = promisifyMaybe(fn)
  }

  validate (fn) {
    this._validate = promisifyMaybe(fn)
  }

  add (weight, fn) {
    this.operations.push([ weight, promisifyMaybe(fn), fn ])
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
    let n = this.randomInt(totalWeight)
    for (const [ weight, op ] of ops) {
      n -= weight
      if (n < 0) return op.call(this)
    }
  }

  randomInt (n) {
    return Math.floor(this.random() * n)
  }

  pick (items) {
    return items.length ? items[this.randomInt()] : null
  }

  async run (n, opts) {
    const validateAll = !!(opts && opts.validateAll)
    await this._setup()
    for (let i = 0; i < n; i++) {
      await this.call(this.operations)
      if (validateAll) await this._validate()
    }
    if (!validateAll) await this._validate()
  }

  debug (...msg) {
    if (this.debugging) console.log('fuzzbuzz:', ...msg)
  }

  async bisect (n) {
    let start = 0
    let end = n
    let ops = 0

    // galloping search ...
    while (start < end) {
      this.debug('bisecting start=' + start + ' and end=' + end)

      let dist = Math.min(1, end - start)
      let ptr = 0
      let i = 0

      this.random = random(this.random.seed)
      await this._setup()

      for (; i < n; i++) {
        try {
          ops++
          await this.call(this.operations)
        } catch (_) {
          break
        }

        if (i < start) continue
        if (dist === ++ptr) {
          try {
            await this._validate()
            start = i + 1
          } catch (err) {
            break
          }
          dist *= 2
        }
      }
      end = i
    }

    // reset the state
    this.random = random(this.random.seed)
    this.debug('min amount of operations=' + (end + 1) + ' (ran a total of ' + ops + ' operations during bisect)')

    return end + 1
  }

  _setup () {
    // overwrite me
  }

  _validate () {
    // overwrite me
  }
}

module.exports = FuzzBuzz

function promisifyMaybe (fn) {
  if (fn.length !== 1) return fn
  return promisify(fn)
}

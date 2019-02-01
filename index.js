const random = require('math-random-seed')
const { randomBytes, createHash } = require('crypto')

class FuzzBuzz {
  constructor (opts) {
    if (!opts) opts = {}

    this.seed = opts.seed || randomBytes(32).toString('hex')
    this.random = random(createHash('sha256').update(this.seed).digest())
    this.operations = []

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

  async run (n, opts) {
    const validateAll = !!(opts && opts.validateAll)
    await this._setup()
    for (let i = 0; i < n; i++) {
      await this.call(this.operations)
      if (validateAll) await this._validate()
    }
    if (!validateAll) await this._validate()
  }

  async bisect (n) {
    let start = 0
    let end = n

    // galloping search ...
    while (start < end) {
      let dist = Math.min(1, end - start)
      let ptr = 0
      let i = 0

      this.random = random(this.random.seed)
      await this._setup()

      for (; i < n; i++) {
        try {
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

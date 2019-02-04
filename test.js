const tape = require('tape')
const FuzzBuzz = require('./')

tape('seed works', function (assert) {
  const fuzz = new FuzzBuzz({ seed: Buffer.alloc(32) })
  const rs = [ fuzz.random(), fuzz.random(), fuzz.random() ]

  assert.same(rs.map(n => typeof n), [ 'number', 'number', 'number' ])

  const copy = new FuzzBuzz({ seed: fuzz.seed })
  assert.same(copy.seed, fuzz.seed)
  assert.same([ copy.random(), copy.random(), copy.random() ], rs)
  assert.end()
})

tape('add operation', async function (assert) {
  const fuzz = new FuzzBuzz()
  let tick = 0

  fuzz.add(1, function () {
    tick++
  })

  await fuzz.run(1000)

  assert.same(tick, 1000)
  assert.end()
})

tape('setup and validate', async function (assert) {
  let tick = 0
  let setup = false
  let validate = false
  const fuzz = new FuzzBuzz({
    async setup () {
      assert.notOk(setup)
      setup = true
      assert.same(tick, 0)
    },
    async validate () {
      assert.notOk(validate)
      validate = true
      assert.same(tick, 100)
    }
  })

  fuzz.add(1, function () {
    if (!setup) assert.fail('not setup')
    if (validate) assert.fail('premature validate')
    tick++
  })

  await fuzz.run(100)
  assert.ok(setup)
  assert.ok(validate)
  assert.same(tick, 100)
  assert.end()
})

tape('setup and validate after construction', async function (assert) {
  let tick = 0
  let setup = false
  let validate = false
  const fuzz = new FuzzBuzz()

  fuzz.setup(async function () {
    assert.notOk(setup)
    setup = true
    assert.same(tick, 0)
  })

  fuzz.validate(async function () {
    assert.notOk(validate)
    validate = true
    assert.same(tick, 100)
  })

  fuzz.add(1, function () {
    if (!setup) assert.fail('not setup')
    if (validate) assert.fail('premature validate')
    tick++
  })

  await fuzz.run(100)
  assert.ok(setup)
  assert.ok(validate)
  assert.same(tick, 100)
  assert.end()
})

tape('operations can be weighted', async function (assert) {
  const fuzz = new FuzzBuzz()

  let a = 0
  let b = 0

  fuzz.add(50, () => a++)
  fuzz.add(1, () => b++)

  await fuzz.run(10000)

  assert.ok(a > 10 * b)
  assert.end()
})

tape('pass operations in constructor', async function (assert) {
  let a = 0
  let b = 0

  const fuzz = new FuzzBuzz({
    operations: [
      [ 50, () => a++ ],
      [ 1, () => b++ ]
    ]
  })

  await fuzz.run(10000)

  assert.ok(a > 10 * b)
  assert.end()
})

tape('async ops', async function (assert) {
  const fuzz = new FuzzBuzz()
  let active = 0
  let tick = 0

  fuzz.add(1, async function () {
    tick++
    active++
    await sleep(1)
    active--
  })

  fuzz.add(1, function (done) {
    tick++
    active++
    setTimeout(function () {
      active--
      done()
    }, 1)
  })

  assert.same(active, 0)
  await fuzz.run(500)
  assert.same(active, 0)
  assert.same(tick, 500)
  assert.end()

  function sleep (n) {
    return new Promise((resolve) => setTimeout(resolve, n))
  }
})

tape('operation randomness follows the seed', async function (assert) {
  const fuzz = new FuzzBuzz()
  const a = []
  const b = []

  fuzz.add(50, () => a.push('50'))
  fuzz.add(1, () => a.push('1'))

  await fuzz.run(10000)

  const copy = new FuzzBuzz({ seed: fuzz.seed })

  copy.add(50, () => b.push('50'))
  copy.add(1, () => b.push('1'))

  await copy.run(10000)

  assert.same(a, b)
  assert.end()
})

tape('operation + other apis randomness follows the seed', async function (assert) {
  const fuzz = new FuzzBuzz()
  const a = []
  const b = []

  fuzz.add(50, function () {
    a.push(fuzz.pick([ 10, 20, 30 ]))
    a.push(50)
  })
  fuzz.add(1, function () {
    a.push(fuzz.pick([ 11, 12, 13 ]))
    a.push(1)
  })

  await fuzz.run(10000)

  const copy = new FuzzBuzz({ seed: fuzz.seed })

  copy.add(50, function () {
    b.push(copy.pick([ 10, 20, 30 ]))
    b.push(50)
  })
  copy.add(1, function () {
    b.push(copy.pick([ 11, 12, 13 ]))
    b.push(1)
  })

  await copy.run(10000)

  assert.same(a, b)
  assert.end()
})

tape('can remove ops', async function (assert) {
  const fuzz = new FuzzBuzz()

  let ok = false
  const fn = () => assert.fail('nej tak')

  fuzz.add(5000, fn)
  fuzz.add(1, function () {
    ok = true
  })

  fuzz.remove(5000, fn)
  await fuzz.run(1000)
  assert.ok(ok)
  assert.end()
})

tape('fuzz the fuzzer', async function (assert) {
  const fuzz = new FuzzBuzz({
    validate () {
      assert.same(other.operations.map(([ w, fn ]) => [ w, fn ]), ops)
    }
  })

  assert.pass('fuzz seed is ' + fuzz.seed)

  const other = new FuzzBuzz()
  const ops = []

  fuzz.add(10, async function add () {
    const fn = () => {}
    const n = fuzz.randomInt(100)
    ops.push([ n, fn ])
    other.add(n, fn)
  })

  fuzz.add(5, async function remove () {
    const n = fuzz.pick(ops)
    if (!n) return

    other.remove(n[0], n[1])
    ops.splice(ops.indexOf(n), 1)
  })

  await fuzz.run(1000)
  assert.end()
})

tape('bisect', async function (assert) {
  const fuzz = new FuzzBuzz({
    setup () {
      this.n = 0
      this.expected = 0
    },
    validate () {
      if (this.n !== this.expected) throw new Error()
    },
    operations: [
      [ 10, add ],
      [ 10, sub ],
      [ 10, mul ],
      [ 1, faulty ]
    ]
  })

  let faults = 0
  let error

  try {
    await fuzz.run(20000)
  } catch (err) {
    error = err
  }

  assert.ok(error, 'run failed')
  assert.ok(faults > 0, 'faulty op ran')

  const n = await fuzz.bisect(20000)
  assert.pass('bisect says we need ' + n + ' runs to fail')

  faults = 0
  error = null

  try {
    await fuzz.run(n)
  } catch (err) {
    error = err
  }

  assert.ok(error, 'still fails')
  assert.same(faults, 1, 'only one fault after rerunning')
  assert.end()

  function add () {
    const r = this.randomInt(10)
    this.n += r
    this.expected += r
  }

  function sub () {
    const r = this.randomInt(10)
    this.n -= r
    this.expected -= r
  }

  function mul () {
    const r = this.random() + 0.5
    this.n *= r
    this.expected *= r
  }

  function faulty () {
    const r = this.randomInt(10)
    this.n += r + 1 // faulty op
    this.expected += r
    faults++
  }
})

require("dotenv").config()

const express = require('express')
const codes = require("../httpcodes")
const router = express.Router()

function isValidColor(color) {
    return color.length === 6 && /^[0-9A-F]{6}$/i.test(color)
}

router.get('/', async (req, res) => {
    const db = req.app.get("db")

    res.render('tags', {
        title: process.env.TITLE,
        tags: await db.select('tags', _ => true),
    })
})

router.get('/:id', async (req, res) => {
    const db = req.app.get("db")
    const data = await db.select('tags', v => v.name === req.params.id)
    res.json(data[0])
})

router.get('/list', async (req, res) => {
    const db = req.app.get("db")
    res.json(await db.select('tags', _ => true))
})

router.post('/add', async (req, res) => {
    const NeededParams = ["name", "color"]

    if (NeededParams.filter(p => p in req.body).length === NeededParams.length) {
        const db = req.app.get("db")

        if (isValidColor(req.body.color)) {
            const existing = await db.select("tags", t => t.name === req.body.name)

            if (existing.length === 0) {
                const ids = await db.insert("tags", {
                    name: req.body.name,
                    color: req.body.color,
                })

                res.json({
                    status: "ok",
                    updated: ids,
                })
            } else {
                res.status(codes.errors.conflict).json({
                    status: "Error",
                    message: `The tag ${req.body.name} already exists. Delete it before trying to add it again`,
                })
            }
        } else {
            res.status(codes.errors.precondition_failed).json({
                status: "Error",
                message: `Invalid color format: ${req.body.color}`,
            })
        }
    } else {
        res.status(codes.errors.precondition_failed).json({
            status: "Error",
            message: `Missing parameter(s): ${NeededParams.filter(p => !(p in req.body))}`,
        })
    }
})

router.delete('/:id', async (req, res) => {
    const id = req.params.id
    const db = req.app.get("db")

    try {
        await db.delete("tags", val => val.name === id)
        await db.update(
            "articles",
            val => val.tags.includes(id),
            val => { return { ...val, tags: val.tags.filter(t => t !== id) } },
        )
        res.json({
            status: "OK",
            deleted: id,
        })
    } catch (e) {
        res.status(codes.errors.not_found).json({
            status: "Error",
            message: `Couldn't find tag with id ${id}`,
        })
    }
})

router.patch('/:id', async (req, res) => {
    const id = req.params.id
    const db = req.app.get("db")

    try {
        // updating the tag name
        if ("name" in req.body && id !== req.body.name) {
            await db.update(
                "articles",
                val => val.tags.includes(id),
                async val => {
                    return {
                        ...val,
                        tags: val.tags.map(t => t === id ? req.body.name : t),
                    }
                },
            )
        }

        await db.update(
            "tags",
            val => val.name === id,
            async val => {
                return {
                    name: req.body.name ?? val.name,
                    color: req.body.color ?? val.color,
                }
            },
        )

        res.json({
            status: "OK",
            updated: id,
        })
    } catch (e) {
        res.status(codes.errors.not_found).json({
            status: "Error",
            message: `Couldn't find tag with id ${id}`,
        })
    }
})

module.exports = router

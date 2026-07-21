export default async function handler(req, res) {
  const q = (req.query.q || '').toString().trim()

  if (q.length < 2) {
    res.status(200).json({ products: [] })
    return
  }

  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
    q
  )}&search_simple=1&action=process&json=1&page_size=8&fields=product_name,code,nutriments`

  try {
    const offResponse = await fetch(url, {
      headers: {
        'User-Agent': 'LeMenu-MealPlanner/1.0 (+https://eat-better-alpha.vercel.app)',
      },
    })

    if (!offResponse.ok) {
      res.status(200).json({ products: [] })
      return
    }

    const data = await offResponse.json()
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    res.status(200).json(data)
  } catch (err) {
    res.status(200).json({ products: [] })
  }
}

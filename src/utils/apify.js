export async function scrapeCompanies(keyword, location) {
  const searchQuery = `${keyword} in ${location}`.trim()

  console.log('Scraping Apify with query:', searchQuery)

  try {
    const response = await fetch(
      `https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=${process.env.APIFY_API_TOKEN}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          searchStringsArray: [searchQuery],
          maxCrawledPlacesPerSearch: 15,
        }),
      }
    )

    const data = await response.json()

    console.log('Apify raw data:', data)

    return data.map((place) => ({
      name: place?.title,
      address: place?.address,
      rating: place?.rating,
      reviews: place?.reviewsCount,
      city: place?.city,
      website: place?.website,
      phone: place?.phone,
      postalCode: place?.postalCode,
    }))
  } catch (err) {
    console.error('Apify error:', err)
    return []
  }
}

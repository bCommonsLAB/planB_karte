db.places.updateMany({}, { $unset: { "properties.Koordinate N": "", "properties.Koordinate O": "" } })

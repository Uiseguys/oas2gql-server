import DataLoader from 'dataloader'

const genericResolveFunction = (obj) => {
  if (obj.length) {
    return {
      id: obj
    }
  } else if (obj._id) {
    return {
      id: obj._id
    }
  } else return null
}

// const loaders = {
//   Driver: new DataLoader(keys => Promise.all(keys.map(getDriverByURL)))
// }

export default {
  Vehicle: {
    associatedDrivers: {
      operationId: 'getDriverById',
      resolveObject: genericResolveFunction
    }
  },
  Driver: {
    associatedVehicles: {
      operationId: 'getVehicleById',
      resolveObject: genericResolveFunction
    }
  }
}

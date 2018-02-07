const genericResolveFunction = (obj) => {
  if (obj.length) {
    return {
      id: obj
    }
  } else return null
}

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

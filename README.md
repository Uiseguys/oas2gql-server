[ ![Codeship Status for Uiseguys/oas2qgl-server](https://app.codeship.com/projects/ae6f2630-ed56-0135-9ef3-6e6ced3859a5/status?branch=master)](https://app.codeship.com/projects/270572)

# OAS to GraphQL

This is an attempt for an [Open API Spec](https://github.com/OAI/OpenAPI-Specification) (formerly Swagger) to [GraphQL](http://graphql.org) converter.

The service generates a graphql server on the fly based on the provided Open Api Schema.

The project is a WIP; everything is highly experimental and rather fragile.

You can find a Live demo [here](https://uiseguys-oas2gql-server.herokuapp.com/graphql)

Provided is partial schema of a [REST API](https://uiseguys-loopback3-server.herokuapp.com/explorer/) (github repo: [https://github.com/Uiseguys/loopback3-server](https://github.com/Uiseguys/loopback3-server) )

Live demo of an angular app that consumes this service can be found [here](https://uiseguys-oas2gql-angular.herokuapp.com/) (github repo: [https://github.com/Uiseguys/oas2gql-angular](https://github.com/Uiseguys/oas2gql-angular) )

---

Installation:

`npm install`

Start up:

`npm start`

Navigate to `localhost:4000/graphql` and run the following query:

```
{
  getLogbook {
    text
    id
  }
}
```

The service should return:

```
{
  "data": {
    "getLogbook": [
      {
        "text": "this is a log",
        "id": "5a674cf651635e4d88f7e017"
      },
      {
        "text": "this is another log",
        "id": "5a674cfa51635e4d88f7e018"
      }
    ]
  }
}
```

---

## Relay 

The resulted server is NOT [relay](https://www.learnrelay.org/) compliant but some filtering is possible through where args:

```
{
  getLogbook(where: {
    id:{
      eq: "5a674cf651635e4d88f7e017"
    }
  }) {
    text
    id
  }
}

```

Should return 

```
{
  "data": {
    "getLogbook": [
      {
        "text": "this is a log",
        "id": "5a674cf651635e4d88f7e017"
      }
    ]
  }
}
```

A sample graphql-relay implementation can be found on the [official page](https://github.com/graphql/graphql-relay-js)

---

## Authentication 

To handle auth, attach proper headers to graphql requests (in apps that consume this service) and they will be passed further down towards the endpoint

Check out [this project](https://github.com/Uiseguys/oas2gql-angular) for reference
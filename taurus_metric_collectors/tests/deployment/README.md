Taurus Metric Collectors Deployment Tests


These non-destructive tests are executed by the Taurus "initialize",
"refresh", and "update" pipelines. They are tasked with performing sanity checks
that validate the viability of the server configuration. The server may be a
part of a live production system.


NOTE: The resource accessibility test suite MUST be executed while the Taurus
Metric Collectors services are stopped to prevent the twitter stream test from
getting throttled indefinitely.
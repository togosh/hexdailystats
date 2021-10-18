#!/bin/bash
forever list
forever stop 0
forever start index.js
forever logs
forever logs 0 -f
debugger;
const main = async () => {
    const currentLocation = window.location
    const baseUrlProtocol = currentLocation.protocol + '//' + currentLocation.hostname
    const response = await fetch(`./top.json?hash=ly2ai8tgLiRHn4fHnG7RY4ukl`); //hash for cache busting
    const topJson = await response.json(); //extract JSON from the http response
    // console.log(topJson)
    // process incoming json into several config objects
    let config = topJson.config
    let examinerData = topJson.examinerData
    let dataFormat = topJson.items
    let dataInput = dataFormat.map(function (i) {
        inputObject = {}
        if (i.extent) {
            inputObject.extent = "ns"
        }
        if (i.intensity) {
            inputObject.intensity = "ns"
        }
        if (i.skill) {
            inputObject.skill = "ns"
        }
        return {
            displayName: i.displayName,
            data: Object.assign({}, inputObject),
            comments: ""
        };
    });
    let dataLine = makeDataLine(dataInput, '', '')
    let userCsvHeader = "Child,Rater,,Engaged (E),Decides (E),Safety (E),Process (E),Social Play (E),Engaged (I),Persist (I),Social Play (I),Affect (I),Interact'n with objects (I),Engaged (S),Modifies (S),Mischief/teasing (S),Pretends (S),Unconvent'l/variable (S),Negotiates (S),Social Play (S),Supports (S),Enters (S),Initiates (S),Clowns/jokes (S),Shares (S),Gives (S),Responds (S),Intract'n with objects (S),Transitions (S),Raw Score,Measure,Outfit Mean Square,Infit Mean Square,Link"
    let adminCsvHeader = "Child,Rater,,Engaged (E),Decides (E),Safety (E),Process (E),Social Play (E),Engaged (I),Persist (I),Social Play (I),Affect (I),Interact'n with objects (I),Engaged (S),Modifies (S),Mischief/teasing (S),Pretends (S),Unconvent'l/variable (S),Negotiates (S),Social Play (S),Supports (S),Enters (S),Initiates (S),Clowns/jokes (S),Shares (S),Gives (S),Responds (S),Intract'n with objects (S),Transitions (S),Raw Score,Model Variance,SEM,Measure,Outfit Mean Square,Infit Mean Square,Link,Examinee Name,Examinee Age,Examinee Diagnosis,Examiner Name,Examination Date,Examination Comments"
    let name = "", age = "", date = "", diagnosis = "", examinerName = "", examinerId = "", comments = "", csvData, itemCount, expectedScore, modelVariance, standardErrorOfMeasurement, rawScore, outfitMeanSquare = 0, infitMeanSquare = 0, outputSuccess, outputError, errorText, itemDifficultyModifier, examinerIdFound = false, debugStepDifficulty, csvDownloadActive = false, csvDownloadContent = "", csvDownloadFilename = "";

    // Populate data using URL
    if (location.hash) {
        dataLine = location.hash.substring(1)
        let output = parseDataLine(dataLine, dataInput)
        name = output.name
        examinerId = output.examinerId
        dataInput = output.dataInput
    }

    // console.log({config, dataFormat, dataInput, dataLine})
    debugStepDifficulty = config.stepDifficulty.map((stepDifficulty) => ({ difficulty: stepDifficulty }))
    outputSuccess = false;
    outputError = false;
    new Vue({
        el: '#app',
        data: {
            name,
            age,
            examinerName,
            examinerId,
            diagnosis,
            date,
            comments,
            dataFormat,
            dataInput,
            dataLine,
            config,
            examinerData,

            csvData,
            csvDownloadActive,
            csvDownloadContent,
            csvDownloadFilename,

            outputSuccess,
            outputError,

            itemCount,
            expectedScore,
            modelVariance,
            standardErrorOfMeasurement,
            rawScore,
            outfitMeanSquare,
            infitMeanSquare,
            itemDifficultyModifier,
            examinerIdFound,
            errorText,
            debugStepDifficulty
        },
        methods: {
            calculate: function (e) {
                // Get the number of non-skipped, not scored items - this goes into the calc for the infitMeanSquareNumerator
                this.itemCount = countItems(this.dataInput)
                // console.log(this.dataInput)
                // console.log(e)
                // console.log("Item Count is: " + this.itemCount)
                // let itemDifficultyModifier = calculateItemDifficultyModifier(this.examinerId, this.config, this.examinerData)
                // console.log(itemDifficultyModifier)
                // dataInput for the scores, dataFormat for the itemDifficulty
                iterationOutput = calculateMeasure(this.dataInput, this.dataFormat, this.config.stepDifficulty, this.itemCount)

                this.expectedScore = iterationOutput.currentEstimate   // This is the measure used in the score calc in the next step
                this.modelVariance = iterationOutput.modelVariance
                this.standardErrorOfMeasurement = 1 / Math.sqrt(iterationOutput.modelVariance)
                this.rawScore = iterationOutput.rawScore
                this.infitMeanSquare = iterationOutput.infitMeanSquare
                this.outfitMeanSquare = iterationOutput.outfitMeanSquare

            },
            routeUpdate: function (e) {
                let self = this
                Vue.nextTick(function () {
                    self.dataLine = makeDataLine(self.dataInput, self.name, self.examinerId)
                    window.history.replaceState(null, '', 'top.html#' + self.dataLine)
                    // console.log(self.dataLine)
                })
            },
            parseDataLine: function (e) {
                let { name, examinerId, dataInput } = parseDataLine(this.dataLine, this.dataInput)
                this.name = name
                this.examinerId = examinerId
                // this.dataInput = dataInput // This might break stuff...
            },
            csvHidePanel: function () {
                this.csvDownloadActive = false
            },
            csvUploaded: function (e) {
                let fileList = e.target.files
                // console.log(this.csvData)
                // console.log(e)
                // console.log(fileList)
                let self = this
                let fileReader = new FileReader()
                if (!fileList.length) return;
                let fileName = ""
                fileReader.onload = function (e) {
                    console.log(e)
                    let fileContents = e.target.result
                    self.csvData = fileContents
                    let perLine = fileContents.split('\n')
                    let calculatedOutput = [userCsvHeader]
                    let adminCalculatedOutput = [adminCsvHeader]

                    const regex = RegExp('[^a-zA-Z0-9\\s-,]')
                    let ignoredInputs = []
                    perLine.forEach(dataLine => {
                        dataLine = dataLine.trim() // Removes any whitespace characters that crept their way in
                        // TODO: Can do some string treatment here to correct common mistakes or something...
                        let skip = regex.test(dataLine)
                        // console.log({dataLine, skip})
                        if (skip) { ignoredInputs.push(dataLine); return; }
                        let csvDataInput = self.dataFormat.map(function (i) {
                            inputObject = {}
                            if (i.extent) {
                                inputObject.extent = "ns"
                            }
                            if (i.intensity) {
                                inputObject.intensity = "ns"
                            }
                            if (i.skill) {
                                inputObject.skill = "ns"
                            }
                            return {
                                displayName: i.displayName,
                                data: Object.assign({}, inputObject),
                                comments: ""
                            };
                        });
                        let name = ""
                        let examinerId = 0
                        let parsedOutput = parseDataLine(dataLine, csvDataInput)
                        name = parsedOutput.name
                        examinerId = parsedOutput.examinerId
                        csvDataInput = parsedOutput.dataInput
                        // console.log({name, examinerId, csvDataInput})
                        // let itemDifficultyModifier = calculateItemDifficultyModifier(examinerId, self.config, self.examinerData)
                        let itemCount = countItems(csvDataInput)
                        let iterationOutput = calculateMeasure(csvDataInput, self.dataFormat, self.config.stepDifficulty, itemCount)
                        let itemLink = '"' + baseUrlProtocol + '/top.html#' + dataLine + '"'
                        let outputLine = makeDataLine(dataInput, name, examinerId) + ',' +
                            iterationOutput.rawScore + ',' +
                            iterationOutput.currentEstimate + ',' +
                            iterationOutput.outfitMeanSquare + ',' +
                            iterationOutput.infitMeanSquare + ',' +
                            itemLink

                        let adminOutputLine = makeDataLine(dataInput, name, examinerId) + ',' +
                            iterationOutput.rawScore + ',' +
                            iterationOutput.modelVariance + ',' +
                            this.standardErrorOfMeasurement + ',' +
                            iterationOutput.currentEstimate + ',' +
                            iterationOutput.outfitMeanSquare + ',' +
                            iterationOutput.infitMeanSquare + ',' +
                            itemLink + ',' +
                            self.name + ',' +
                            self.age + ',' +
                            self.diagnosis + ',' +
                            self.examinerName + ',' +
                            self.date + ',' +
                            self.comments

                        calculatedOutput.push(outputLine)
                        adminCalculatedOutput.push(adminOutputLine)
                        // console.log({iterationOutput})
                    })
                    // console.log({calculatedOutput})
                    // Provide file for download
                    var element = document.createElement('a');
                    var fileContent = encodeURIComponent(
                        calculatedOutput.join('\n') + '\n\n\n' +
                        "The following inputs were ignored due to improper formatting:,Note: the title of your data may appear here, and that's expected\n\n" +
                        ignoredInputs.join('\n')
                    )
                    self.csvDownloadActive = true
                    self.csvDownloadFilename = filename + "-processed.csv"
                    self.csvDownloadContent = 'data:text/csv;charset=utf-8,' + fileContent

                    let adminFileName = encodeURIComponent((new Date()).toISOString()) + '.log'
                    let adminFileContent = adminCalculatedOutput.join('\n')

                    fetch(`${baseUrlProtocol}/topLogs/${adminFileName}`, {
                        method: 'PUT',
                        headers: {
                            'x-amz-acl': 'bucket-owner-full-control'
                        },
                        body: adminFileContent
                    })
                        .then(response => response)
                        .then(result => {
                            console.log('Success:', result);
                        })
                        .catch(error => {
                            console.error('Error:', error);
                        });

                    element.setAttribute('href', self.csvDownloadContent);
                    element.setAttribute('download', self.csvDownloadFilename);
                    element.style.display = 'none';

                    document.body.appendChild(element);

                    element.click();

                    document.body.removeChild(element);
                }
                filename = fileList[0].name.split('.')[0]
                fileReader.readAsText(fileList[0]) // TODO: Allow multiple csv uploads?
            }
        }
    });
}

console.log('just before main')
main()

function makeDataLine(dataInput, subjectId, raterId) {
    let extent = []
    let intensity = []
    let skill = []
    dataInput.forEach(function (val, index) {
        if (val.data.extent) {
            if (val.data.extent === 'ns') {
                extent.push(null)
            }
            else {
                extent.push(val.data.extent)
            }
        }
        if (val.data.intensity) {
            if (val.data.intensity === 'ns') {
                intensity.push(null)
            }
            else {
                intensity.push(val.data.intensity)
            }
        }
        if (val.data.skill) {
            if (val.data.skill === 'ns') {
                skill.push(null)
            }
            else {
                skill.push(val.data.skill)
            }
        }
    })
    let dataLineArray = [subjectId, raterId, '1-26'].concat(extent, intensity, skill)
    return dataLineArray.join()
}

function parseDataLine(dataLine, dataInput) {
    let dataLineArray = dataLine.split(',')
    let name = dataLineArray[0]
    let examinerId = dataLineArray[1]
    dataLineArray = dataLineArray.slice(3) // Removing garbage characters
    dataInput.forEach(function (val, index) {
        if (val.data.extent) {
            let newValue = dataLineArray.shift()
            if (newValue === "") {
                dataInput[index].data.extent = 'ns'
            }
            else {
                dataInput[index].data.extent = newValue
            }
        }
    })
    dataInput.forEach(function (val, index) {
        if (val.data.intensity) {
            let newValue = dataLineArray.shift()
            if (newValue === "") {
                dataInput[index].data.intensity = 'ns'
            }
            else {
                dataInput[index].data.intensity = newValue
            }
        }
    })
    dataInput.forEach(function (val, index) {
        if (val.data.skill) {
            let newValue = dataLineArray.shift()
            if (newValue === "") {
                dataInput[index].data.skill = 'ns'
            }
            else {
                dataInput[index].data.skill = newValue
            }
        }
    })
    const regex2 = RegExp('[\\s,]*') // checking to see if remaining data (if any) is just blank
    let good = regex2.test(dataLineArray.join())
    if (!good) { console.log("Found a skip here", dataLine, dataLineArray.join()) }
    return { name, examinerId, dataInput }
}

function countItems(dataInput) {
    return dataInput.map(function (input) {
        count = Object.values(input.data)
            .reduce((prev, curr) => curr === "ns" ? prev : prev + 1, 0)
        return count
    }).reduce((prev, curr) => prev + curr, 0)
}

function perItemMath(itemDifficulty, abilityEstimate, inputData, stepDifficulty) {
    // Item difficulty is per the item
    // Ability estimate initially 0 and then gets updated over time with the (rawScore - expectedScore)/updateDivisor
    // inputData is the score for this item
    // step difficulty is the array of step difficulty for the test
    const logit = abilityEstimate - itemDifficulty

    let normalizer = 0   // cumulative
    let expectation = 0 // cumulative
    let sumSquare = 0   // cumulative
    let currentLogit = 0 // cumulative
    let remark = ""

    for (let i = 1; i < stepDifficulty.length; i++) {
        currentLogit = currentLogit + logit - stepDifficulty[i];
        const value = Math.exp(currentLogit)
        normalizer = normalizer + value
        expectation = expectation + i * value
        sumSquare = sumSquare + i * i * value
    }
    expectation = expectation / normalizer
    const variance = (sumSquare / normalizer) - (expectation * expectation)
    const residual = inputData - expectation
    const standardizedResidual = residual / Math.sqrt(variance)
    if (standardizedResidual > 2) {
        remark = "Unexpectedly high rating"
    }
    else if (standardizedResidual < -2) {
        remark = "Unexpectedly low rating"
    }

    const itemOutfitMeanSquareNumerator = standardizedResidual * standardizedResidual
    const itemInfitMeanSquareNumerator = residual * residual
    const itemInfitMeanSquareDivisor = variance

    return { expectation, variance, itemOutfitMeanSquareNumerator, itemInfitMeanSquareNumerator, itemInfitMeanSquareDivisor, remark }
}

// not used 
function calculateItemDifficultyModifier(examinerId, config, examinerData) {
    let modifier = 0
    if ((typeof examinerId !== 'undefined') && (examinerData[examinerId])) {
        modifier += examinerData[examinerId].measure
    }
    else {
        modifier += examinerData.default.measure
    }
    return modifier
}

// TODO: Add success flag and error message
function calculateMeasure(
    dataInput,
    dataFormat,
    stepDifficulty,
    itemCount
) {
    const initialEstimate = 0
    const convergenceTolerance = 0.01
    const maxIterations = 100
    const minUpdateDivisor = 1
    const maxChange = 1.0

    let previousPreviousEstimate = initialEstimate
    let previousEstimate = initialEstimate
    let currentEstimate = initialEstimate

    let outputMath
    let updateDivisor
    let iterationCount = 0
    let converged = false

    do {
        outputMath = calculateExpectedScore(
            dataInput,
            dataFormat,
            currentEstimate,
            stepDifficulty
        )

        const modelVariance = outputMath.modelVariance
        const expectedScore = outputMath.expectedScore
        const rawScore = outputMath.rawScore

        if (!Number.isFinite(modelVariance) || modelVariance <= 0) {
            throw new Error(
                `Invalid model variance: ${modelVariance}`
            )
        }

        if (
            updateDivisor === undefined ||
            !hasOverShotEstimate(
                previousPreviousEstimate,
                previousEstimate,
                currentEstimate
            )
        ) {
            updateDivisor = modelVariance
        }
        else {
            updateDivisor = Math.max(
                updateDivisor * 2,
                minUpdateDivisor
            )
        }

        let change =
            (rawScore - expectedScore) / updateDivisor

        change = Math.max(
            -maxChange,
            Math.min(maxChange, change)
        )

        previousPreviousEstimate = previousEstimate
        previousEstimate = currentEstimate
        currentEstimate = previousEstimate + change

        iterationCount++

        if (!Number.isFinite(currentEstimate)) {
        console.error(
            `Ability estimate became non-finite`
        )
        throw new Error(
            "Ability estimate became non-finite"
        )
        }

        converged =
            Math.abs(currentEstimate - previousEstimate) <
            convergenceTolerance

    } while (!converged && iterationCount < maxIterations)

    if (!converged) {
        console.error(
            `Measure failed to converge after ${iterationCount} iterations`
        )
    }

    if (iterationCount === maxIterations) {
        console.error(
            `Max iterations reached without convergence`
        )
    }
    /*
     * Recalculate once at the final estimate so modelVariance,
     * residuals, infit, and outfit all correspond to the returned
     * currentEstimate.
     */
    outputMath = calculateExpectedScore(
        dataInput,
        dataFormat,
        currentEstimate,
        stepDifficulty
    )

    const modelVariance = outputMath.modelVariance
    const rawScore = outputMath.rawScore

    let outfitMeanSquare =
        outputMath.outfitMeanSquareNumerator / itemCount

    const infitMeanSquare =
        outputMath.infitMeanSquareNumerator /
        outputMath.infitMeanSquareDivisor

    outfitMeanSquare = Math.min(outfitMeanSquare, 9.9)

    return {
        currentEstimate,
        modelVariance,
        rawScore,
        outfitMeanSquare,
        infitMeanSquare,
        iterationCount,
        converged
    }
}

// Iterate thru the scores and return expectedScore, modelVariance, rawScore, 
// outfitMeanSquareNumerator, infitMeanSquareNumerator, infitMeanSquareDivisor
function calculateExpectedScore(dataInput, dataFormat, abilityEstimate, stepDifficulty) {
    let rawScore = 0 // for every item that is not a skip or no score, increase by 1
    let itemDifficulty; // from the itemdifficulty for the item
    let perItemResults; // object from per item math
    let expectedScore = 0 // cumulative
    let modelVariance = 0 // cumulative
    let outfitMeanSquareNumerator = 0 // cumulative from perItemMath
    let infitMeanSquareNumerator = 0 // cumulative from perItemMath
    let infitMeanSquareDivisor = 0 // cumulative from perItemMath

    // TODO: somewhere this should bomb out if the stepDifficulty array doesn't have the same 
    // number of elements as the number of possible values
    dataInput.map(function (input, i) {
        let dataFormatEntry = dataFormat[i] // Just using this to get the itemDifficulty
        if (input.data.extent && input.data.extent !== "ns") {
            rawScore = rawScore + Number(input.data.extent)
            itemDifficulty = dataFormatEntry.extentDetail.itemDifficulty
            perItemResults = perItemMath(itemDifficulty, abilityEstimate, Number(input.data.extent), stepDifficulty)
            expectedScore = expectedScore + perItemResults.expectation
            modelVariance = modelVariance + perItemResults.variance
            outfitMeanSquareNumerator = outfitMeanSquareNumerator + perItemResults.itemOutfitMeanSquareNumerator
            infitMeanSquareNumerator = infitMeanSquareNumerator + perItemResults.itemInfitMeanSquareNumerator
            infitMeanSquareDivisor = infitMeanSquareDivisor + perItemResults.itemInfitMeanSquareDivisor
        }
        if (input.data.intensity && input.data.intensity !== "ns") {
            rawScore = rawScore + Number(input.data.intensity)
            itemDifficulty = dataFormatEntry.intensityDetail.itemDifficulty
            perItemResults = perItemMath(itemDifficulty, abilityEstimate, Number(input.data.intensity), stepDifficulty)
            expectedScore = expectedScore + perItemResults.expectation
            modelVariance = modelVariance + perItemResults.variance
            outfitMeanSquareNumerator = outfitMeanSquareNumerator + perItemResults.itemOutfitMeanSquareNumerator
            infitMeanSquareNumerator = infitMeanSquareNumerator + perItemResults.itemInfitMeanSquareNumerator
            infitMeanSquareDivisor = infitMeanSquareDivisor + perItemResults.itemInfitMeanSquareDivisor
        }
        if (input.data.skill && input.data.skill !== "ns") {
            rawScore = rawScore + Number(input.data.skill)
            itemDifficulty = dataFormatEntry.skillDetail.itemDifficulty
            perItemResults = perItemMath(itemDifficulty, abilityEstimate, Number(input.data.skill), stepDifficulty)
            expectedScore = expectedScore + perItemResults.expectation
            modelVariance = modelVariance + perItemResults.variance
            outfitMeanSquareNumerator = outfitMeanSquareNumerator + perItemResults.itemOutfitMeanSquareNumerator
            infitMeanSquareNumerator = infitMeanSquareNumerator + perItemResults.itemInfitMeanSquareNumerator
            infitMeanSquareDivisor = infitMeanSquareDivisor + perItemResults.itemInfitMeanSquareDivisor
        }
    })
    modelVariance = modelVariance < 0.00001 ? 0.00001 : modelVariance
    // console.log({ expectedScore, modelVariance, rawScore })
    return { expectedScore, modelVariance, rawScore, outfitMeanSquareNumerator, infitMeanSquareNumerator, infitMeanSquareDivisor }
}

// Decide if the current estimate is wildly different from the previous one
function hasOverShotEstimate(prevprev, prev, curr) {
    return (
        (prevprev < prev && curr < prev) ||
        (prevprev > prev && curr > prev)
    )
}
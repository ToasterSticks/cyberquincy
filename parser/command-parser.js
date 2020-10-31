const Parsed = require('./parsed.js');
const OptionalParser = require('./optional-parser.js');
const OrParser = require('./or-parser.js');
const EmptyParser = require('./empty-parser.js');
const AnyOrderParser = require('./any-order-parser.js');

isAbstractParser = function (parser) {
    return ABSTRACT_PARSERS.map((ap) => ap.parser).includes(parser.constructor);
};

module.exports = {
    /**
     * Parses arguments minding the ordering `parsers` array
     * Takes into account abstract parsers and resolves them to be concrete
     *  - If there is a perfect match then return it.
     *  - If not, return the attempt with the fewest errors.
     *
     * @param {[String]} args Command arguments
     * @param  {...{Type}Parser} parsers An expanded list of parsers; some may be optional
     */
    parse(args, ...parsers) {
        let parseds = concretizeAndParse(args, parsers, 0);

        // Sort parsing errors from least to most caught errors
        parseds.sort((a, b) => a.parsingErrors.length - b.parsingErrors.length);

        // The one with the least number of errors is likely to tell the best story
        return parseds[0];
    },

    isAbstractParser,
};

concretizeAndParse = function (args, parsers, abstractParserIndex) {
    // Base case: all abstract parsers have been concretized
    if (parsers.filter((p) => isAbstractParser(p)).length == 0) {
        return [parseConcrete(args, parsers)];
    }

    // Get abstact parser function using the cycling index
    const concretizeParserFunction =
        ABSTRACT_PARSERS[abstractParserIndex].handler;
    // and call the function on the parsers
    const moreConcreteParsingAttempts = concretizeParserFunction.call(
        this,
        parsers
    );

    let parseds = [];

    // Loop through the results and recurse, then taking the most successful result
    // i.e. either the successful parsing attempt or the attempt with the fewest errors
    for (var i = 0; i < moreConcreteParsingAttempts.length; i++) {
        // Unpack results
        const moreConcreteParsers = moreConcreteParsingAttempts[i].parsers;
        const alreadyParsed = moreConcreteParsingAttempts[i].parsed;

        // Cycle to the next abstract parser
        const newAbstractParserIndex =
            (abstractParserIndex + 1) % this.ABSTRACT_PARSERS.length;

        // Recurse and save result
        const newParseds = concretizeAndParse(
            args,
            moreConcreteParsers,
            newAbstractParserIndex
        );

        parseds.push(...newParseds.map((pd) => pd.merge(alreadyParsed)));
    }

    return parseds;
};

/**
 * Finds the first optional parser
 *   - If it exists, the parser list gets slightly concretized:
 *     the function creates two new parser lists by replacing
 *     the OptionalParser in one list with the wrapped parser
 *     in its place and for the other list NO parser in its place.
 * If there is no OptionalParser, the function just returns the whole parser list
 */
useItOrLoseIt = function (parsers) {
    optionalParserIndex = parsers.findIndex((p) => p instanceof OptionalParser);

    // Return the whole list if there's no OptionalParser found
    if (optionalParserIndex == -1) {
        return [{ parsers: parsers, parsed: new Parsed() }];
    }

    opt = parsers[optionalParserIndex];

    // Include the optional parser's wrapped parser
    useIt = parsers
        .slice(0, optionalParserIndex)
        .concat(opt.parser)
        .concat(parsers.slice(optionalParserIndex + 1));

    // Exclude the optional parser's wrapped parser
    loseIt = parsers
        .slice(0, optionalParserIndex)
        .concat(parsers.slice(optionalParserIndex + 1));

    // Include the parsed value in the return object
    loseItParsed = new Parsed();
    loseItParsed.addField(opt.parser.type(), opt.defaultValue);

    return [
        { parsers: useIt, parsed: new Parsed() },
        { parsers: loseIt, parsed: loseItParsed },
    ];
};

/**
 * Finds the first OrParser
 *   - If it exists, the parser list gets slightly concretized.
 *     Each newly created parser list will be the original parser
 *     list except the OrParser is replaced with one of the parser lists
 *     specified in the command's OrParser constructor.
 * If there is no OrParser, the function just returns the original list
 */
expandOrParser = function (parsers) {
    orParserIndex = parsers.findIndex((p) => p instanceof OrParser);

    // Return the whole list if there's no OrParser found
    if (orParserIndex == -1) {
        return [{ parsers: parsers, parsed: new Parsed() }];
    }

    parserLists = [];
    orParser = parsers[orParserIndex];

    // Create a new list for every parserList provided in the command's OrParser constructor
    for (var i = 0; i < orParser.parserLists.length; i++) {
        parserLists.push(
            parsers
                .slice(0, orParserIndex)
                .concat(orParser.parserLists[i])
                .concat(parsers.slice(orParserIndex + 1))
        );
    }

    // No values were parsed in the OrParser concretization process
    return parserLists.map(function (l) {
        return { parsers: l, parsed: new Parsed() };
    });
};

/**
 * Finds the first EmptyParser
 *   - If it exists, the parser list gets slightly concretized:
 *     the EmptyParser is simply removed.
 * If there is no EmptyParser, the function just returns the original list
 */
removeEmptyParser = function (parsers) {
    emptyParserIndex = parsers.findIndex((p) => p instanceof EmptyParser);

    // Return the whole list if there's no OrParser found
    if (emptyParserIndex == -1) {
        return [{ parsers: parsers, parsed: new Parsed() }];
    }

    // Just remove the EmptyParser if it exists
    moreConcreteParsers = parsers
        .slice(0, emptyParserIndex)
        .concat(parsers.slice(emptyParserIndex + 1));

    // No values were parsed in the OrParser concretization process
    return [{ parsers: moreConcreteParsers, parsed: new Parsed() }];
};

permutateParsers = function (parsers) {
    anyOrderParserIndex = parsers.findIndex((p) => p instanceof AnyOrderParser);

    // Return the whole list if there's no OrParser found
    if (anyOrderParserIndex == -1) {
        return [{ parsers: parsers, parsed: new Parsed() }];
    }
    
    subParsers = parsers[anyOrderParserIndex].parsers
    // Get all permutations of parser ordering
    parserPermutations = h.allLengthNPermutations(subParsers);

    parserLists = [];
    for (var i = 0; i < parserPermutations.length; i++) {
        parserLists.push(
            parsers
                .slice(0, anyOrderParserIndex)
                .concat(parserPermutations[i])
                .concat(parsers.slice(anyOrderParserIndex + 1))
        );
    }

    return parserPermutations.map(function (l) {
        return { parsers: l, parsed: new Parsed() };
    });
}

/**
 * A list of different types of abstract parsers
 * and the handler that concretizes it.
 * Handlers must take a parser list and return an object:
 *   - {parsers: parserList, parsed: ParsedObject}
 *     where `parserList` is the same list of parsers but with
 *     at least one instance of the specified parser type
 *     concretized if it can be found at the top level of the list.
 *     and `parsed` is whatever might've been parsed in the concretization
 *     (such as a default value that sticks in for an unused OptionalParser)
 */
ABSTRACT_PARSERS = [
    { parser: OptionalParser, handler: useItOrLoseIt },
    { parser: OrParser, handler: expandOrParser },
    { parser: EmptyParser, handler: removeEmptyParser },
    { parser: AnyOrderParser, handler: permutateParsers},
];
    
/**
 * Attempts to parse and returns the result if fully successful
 * Otherwise throws a ParsingError encapsulating all command errors encountered along the way.
 *
 * @param {[String]} args Command arguments
 * @param {[{Type}Parser]} parsers An expanded list of parsers
 */
parseConcrete = function (args, parsers) {
    // The returned result that the command can read
    parsed = new Parsed();

    // Iterate over parsers + arguments
    for (let i = 0; i < Math.min(parsers.length, args.length); i++) {
        parser = parsers[i];
        arg = args[i];

        if (isAbstractParser(parser)) {
            throw `Abstract parser of type ${typeof Parser} found in concrete parsing. Something went wrong here.`;
        }

        try {
            value = parser.parse(arg);
            parsed.addField(parser.type(), value);
        } catch (e) {
            if (e instanceof UserCommandError) {
                parsed.addError(e);
            } else {
                // DeveloperCommandError for example
                throw e;
            }
        }
    }

    // Include an error for every missing argument
    for (let i = args.length; i < parsers.length; i++) {
        parsed.addError(
            new UserCommandError(
                `Command is missing ${h.toOrdinalSuffix(
                    i + 1
                )} argument of type \`${parsers[i].type()}\``
            )
        );
    }

    // Include an error for every extra argument
    for (let i = parsers.length; i < args.length; i++) {
        parsed.addError(
            new UserCommandError(
                `Extra argument \`${args[i]}\` at position ${i + 1}`
            )
        );
    }

    return parsed;
};

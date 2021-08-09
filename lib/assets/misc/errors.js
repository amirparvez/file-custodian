// Customizable errors thrown by the library.

export default [
    { abbr: "ic", errorObj: () => { return new Error("Invalid Configuration"); }, },
    { abbr: "ov_io", errorObj: () => { return new Error("Invalid Validation Options"); }, },
    { abbr: "ov_vf", errorObj: (against) => { return new Error(against.toUpperCase()+" Validation Failed"); }, },
    { abbr: "ov_isn", errorObj: () => { return new Error("Invalid Schema Name"); }, },
    { abbr: "c_ifh", errorObj: () => { return new Error("Invalid File Handler"); }, },
    { abbr: "c_idfh", errorObj: () => { return new Error("Invalid Default File Handler"); }, },
    { abbr: "c_ifho", errorObj: () => { return new Error("Invalid File Handler Options"); }, },
    { abbr: "c_idbho", errorObj: () => { return new Error("Invalid Database Handler Options"); }, },
    { abbr: "c_ifpo", errorObj: () => { return new Error("Invalid File Protector Options"); }, },
];

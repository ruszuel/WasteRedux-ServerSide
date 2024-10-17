const mockUsers = [
    {username: "Russuel", school: "BSU", color:"pink"},
    {username: "Lloyd", school: "BPC", color:"blue"},
    {username: "Andrei", school: "BSU", color:"black"},
]

const display = (req, res) => {
    res.status(200).json(mockUsers)
}

export default display;